"""python -m backend.build --data data (offline build, deterministic seeds)."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
from tempfile import NamedTemporaryFile

import numpy as np
import pandas as pd
from .decision import OPTIONS, band, features, logistic, zone
from .tracking import snap_data
from .tracking_audit import inventory

HERE = Path(__file__).resolve().parent
KEY = ["gameId", "playId"]
B = 3000
SEED = 2021


def fit(x, y, weights=None):
    weights = np.ones(len(y)) if weights is None else weights
    beta = np.zeros(x.shape[1])
    ridge = np.diag([0.] + [1.] * (x.shape[1]-1))
    for _ in range(35):
        p = logistic(x @ beta)
        score = x.T @ (weights * (y-p)) - ridge @ beta
        h = (x.T * (weights*p*(1-p))) @ x + ridge
        step = np.linalg.solve(h, score)
        beta += step
        if np.max(np.abs(step)) < 1e-8:
            break
    return beta


def interval(values):
    v = np.asarray(values)
    v = v[np.isfinite(v)]
    return np.quantile(v, [.025,.975]).tolist() if v.size else None


class GameBootstrap:
    """Same game resamples across groups/models within each half."""
    def __init__(self, games, seed):
        self.games = np.asarray(games)
        k = len(games)
        self.w = np.random.default_rng(seed).multinomial(k, np.full(k, 1/k), size=B)

    def by_game(self, q, col):
        return q.groupby("gameId")[col].agg(["sum","size"]).reindex(self.games,fill_value=0).to_numpy()

    def rate(self, q, col):
        totals = self.by_game(q, col)
        v = self.w @ totals
        draws = np.divide(v[:,0], v[:,1], out=np.full(B,np.nan), where=v[:,1]>0)
        return draws

    def group(self, q):
        n = len(q)
        k = int(q.gameId.nunique())
        return dict(n=n, partidos=k, exitos=int(q.hit.sum()), tasa=float(q.hit.mean()) if n else None,
                    ic95=interval(self.rate(q,"hit")) if k >= 2 else None)


def compare(q, boot, strata):
    # Overlap weights, proportional to nA*nB/(nA+nB), within a half.
    # Drop strata with <2 actual observations per arm; fix eligible strata for bootstrap.
    groups = []
    for _, cell in q.groupby(strata):
        arms = [cell[cell.offenseFormation.eq(a)] for a in OPTIONS]
        if min(map(len,arms)) >= 2:
            groups.append([boot.by_game(arm,"hit") for arm in arms])
    if not groups:
        return dict(n=0,estratos=0,diferencia=None,ic95=None)
    arr=np.asarray(groups)  # stratum, arm, game, sum/size
    weights=np.vstack([np.ones(len(boot.games)),boot.w])
    v=np.einsum("bg,sagk->bsak",weights,arr,optimize=True)
    s0,n0=v[:,:,0,:].transpose(2,0,1)
    s1,n1=v[:,:,1,:].transpose(2,0,1)
    total=n0+n1
    def divide(a,b):
        return np.divide(a,b,out=np.zeros_like(a,dtype=float),where=b>0)
    den=divide(n0*n1,total).sum(axis=1)
    num=divide(s0*n1-s1*n0,total).sum(axis=1)
    diff=np.divide(num,den,out=np.full(len(den),np.nan),where=den>0)
    arms={}
    for i,a in enumerate(OPTIONS):
        vals=arr[:,i].sum(axis=0)
        vboot=boot.w @ vals
        arms[a]=dict(n=int(vals[:,1].sum()),partidos=int((vals[:,1]>0).sum()),
                     tasa=float(vals[:,0].sum()/vals[:,1].sum()),
                     ic95=interval(divide(vboot[:,0],vboot[:,1])[vboot[:,1]>0]))
    return dict(n=sum(a["n"] for a in arms.values()),estratos=len(groups),opciones=arms,
                diferencia=float(diff[0]),ic95=interval(diff[1:]))


def audit_tables(data):
    tables={}
    audit={}
    for name,keys in [("games",["gameId"]),("plays",KEY),("players",["nflId"]),("pffScoutingData",KEY+["nflId"])]:
        path=data/(name+".csv")
        if name=="plays" and not path.exists():
            path=data/"plays(1).csv"
        t=pd.read_csv(path)
        if t[keys].isna().any().any() or t.duplicated(keys).any():
            raise ValueError(f"Clave incompleta o duplicada en {name}")
        tables[name]=t
        audit[name]=dict(filas=len(t),columnas=len(t.columns),claves=keys,duplicados=0,
                         nulos={k:int(v) for k,v in t.isna().sum().items() if v},
                         sha256=sha256(path.read_bytes()).hexdigest())
    g,p,players,s=(tables[n] for n in ("games","plays","players","pffScoutingData"))
    if not p.gameId.isin(g.gameId).all() or not s.nflId.isin(players.nflId).all():
        raise ValueError("Referencia huérfana de partido o jugador")
    if not pd.MultiIndex.from_frame(s[KEY]).isin(pd.MultiIndex.from_frame(p[KEY])).all():
        raise ValueError("Scouting sin jugada")
    qb=s.loc[s.pff_role=="Pass",KEY+["nflId"]].merge(players[["nflId","displayName"]],validate="m:1")
    roles=s.groupby(KEY).size().rename("jugadores")
    p=p.merge(g,on="gameId",validate="m:1").merge(qb,on=KEY,how="left",validate="1:1").join(roles,on=KEY)
    audit["cobertura"]={"sin_pasador":int(p.nflId.isna().sum()),"sin_22_roles":int(p.jugadores.ne(22).sum())}
    return g,p,audit


def prepare(p):
    p=p.copy()
    p["goal"]=np.where(p.possessionTeam.eq(p.yardlineSide),100-p.yardlineNumber,p.yardlineNumber)
    valid_side=p.yardlineNumber.eq(50)|p.possessionTeam.eq(p.yardlineSide)|p.defensiveTeam.eq(p.yardlineSide)
    exclusions={}
    for label,keep in [
        ("fuera_de_tercero",p.down.eq(3)),("sin_distancia_positiva",p.yardsToGo.gt(0)),
        ("falta_o_jugada_anulada",p[["foulName1","foulName2","foulName3","penaltyYards"]].isna().all(axis=1)&
            ~p.playDescription.str.contains(r"no play|penalty",case=False,na=False)),
        ("resultado_o_campo_invalido",p.playResult.notna()&valid_side&p.yardsToGo.le(p.goal)&p.passResult.isin(["C","I","IN","R","S"]))]:
        keep=keep.reindex(p.index)
        exclusions[label]=int((~keep).sum())
        p=p.loc[keep].copy()
    p["hit"]=(p.playResult.ge(p.yardsToGo)&p.passResult.ne("IN")).astype(int)
    p["banda"]=p.yardsToGo.map(band)
    p["zona"]=p.goal.map(zone)
    return p,exclusions


def evaluate(train,test,bt):
    predictions={}
    complete=[q[q.defendersInBox.notna()].copy() for q in (train,test)]
    for name in ["constante","distancia","distancia_y_zona","distancia_zona_caja"]:
        xx=[]
        for q in complete:
            x=features(q.yardsToGo,q.goal)
            if name=="constante": x=x[:,:1]
            if name=="distancia": x=x[:,:2]
            if name=="distancia_zona_caja": x=np.column_stack((x,q.defendersInBox-6))
            xx.append(x)
        y=complete[0].hit.to_numpy()
        coef=fit(xx[0],y)
        predictions[name]=logistic(xx[1] @ coef)
    q=complete[1]
    metrics={}
    for name,prob in predictions.items():
        q["loss"]=(prob-q.hit)**2
        metrics[name]=dict(brier=q.loss.mean(),ic95=interval(bt.rate(q,"loss")))
    for name,base in [("valor_distancia","constante"),("valor_caja","distancia_y_zona")]:
        ext="distancia" if name=="valor_distancia" else "distancia_zona_caja"
        q["delta"]=(predictions[base]-q.hit)**2-(predictions[ext]-q.hit)**2
        metrics[name]=dict(mejora=q.delta.mean(),ic95=interval(bt.rate(q,"delta")))
    q=q.assign(pred=predictions["distancia_y_zona"])
    cal=[]
    for lo,hi in [(0,.3),(.3,.4),(.4,.5),(.5,1.)]:
        block=q[q.pred.ge(lo)&q.pred.lt(hi)]
        if len(block): cal.append(dict(rango=[lo,hi],p_media=block.pred.mean(),**bt.group(block)))
    return dict(desarrollo=len(complete[0]),n=len(q),partidos=int(q.gameId.nunique()),metricas=metrics,calibracion=cal)


def build(data):
    games,p,audit=audit_tables(data)
    q,exclusions=prepare(p)
    ids=np.random.default_rng(SEED).permutation(sorted(games.gameId))
    halves=np.array_split(ids,2)
    train,test=[q[q.gameId.isin(ids)].copy() for ids in halves]
    boots=[GameBootstrap(ids,SEED+i+1) for i,ids in enumerate(halves)]
    x=features(train.yardsToGo,train.goal)
    y=train.hit.to_numpy()
    coef=fit(x,y)
    indices=pd.Index(halves[0]).get_indexer(train.gameId)
    coefs=[fit(x,y,w[indices]).tolist() for w in boots[0].w[:500]]
    resumen=dict(fuente="NFL regional 2021, semanas 1–8",unidad="jugada",objetivo="Alcanzar yardsToGo sin intercepción en tercer down de pase; aproximación por yardas.",
                 auditoria=audit,exclusiones=exclusions,mitades={},modelos=evaluate(train,test,boots[1]),
                 tracking={"estado":"pendiente","brier_con_posiciones":None,"mejora_con_posiciones":None})
    cells={}
    for part,h,ids,boot in zip(("desarrollo","confirmacion"),(train,test),halves,boots):
        rates={b:boot.group(block) for b,block in h.groupby("banda")}
        short=h[h.banda=="1–3"]
        long=h[h.banda=="7+"]
        diff=boot.rate(short,"hit")-boot.rate(long,"hit")
        only=h[h.offenseFormation.isin(OPTIONS)].copy()
        exact=compare(only,boot,["possessionTeam","yardsToGo","zona"])
        grouped=compare(only,boot,["possessionTeam","banda","zona"])
        # Out-of-fold expected values for discovery; full development fit on confirmation.
        only["p_base"]=logistic(features(only.yardsToGo,only.goal) @ coef)
        if part=="desarrollo":
            for fold in np.array_split(ids,5):
                htrain=train[~train.gameId.isin(fold)]
                mask=only.gameId.isin(fold)
                b=fit(features(htrain.yardsToGo,htrain.goal),htrain.hit.to_numpy())
                only.loc[mask,"p_base"]=logistic(features(only.loc[mask,"yardsToGo"],only.loc[mask,"goal"]) @ b)
        only["residuo"]=only.hit-only.p_base
        raw={a:dict(**boot.group(block),ventaja=block.residuo.mean(),ic95_ventaja=interval(boot.rate(block,"residuo"))) for a,block in only.groupby("offenseFormation")}
        resumen["mitades"][part]=dict(**boot.group(h),gameIds=ids.tolist(),por_distancia=rates,formaciones=raw,
            corta_menos_larga=dict(diferencia=short.hit.mean()-long.hit.mean(),ic95=interval(diff)),
            empty_menos_shotgun_ajustado=grouped,sensibilidad_distancia_exacta=exact)
        clock=h.gameClock.str.split(":",expand=True).astype(int)
        close=h[h.quarter.eq(4)&(60*clock[0]+clock[1]).le(300)&(h.preSnapHomeScore-h.preSnapVisitorScore).abs().le(8)]
        resumen["mitades"][part]["final_cerrado_exploratorio"]=dict(
            criterio="Cuarto periodo, últimos 5 minutos, margen absoluto de hasta 8 puntos",
            **boot.group(close))
    for team,sub in [("*",train),*train.groupby("possessionTeam")]:
        for (b,z),h in sub.groupby(["banda","zona"]):
            cells[f"{team}|{b}|{z}"]=dict(distancias=sorted(map(int,h.yardsToGo.unique())),grupo=boots[0].group(h),
                opciones=[dict(formacion=a,**boots[0].group(h[h.offenseFormation==a])) for a in OPTIONS])
    # Take one play of each outcome in reserved games, ordered by ID, plus the requested example.
    demo=test.sort_values(KEY).drop_duplicates("passResult")
    demo=pd.concat([demo,q[(q.gameId==2021090900)&(q.playId==97)]]).drop_duplicates(KEY)
    plays={}
    for r in demo.itertuples():
        play=dict(gameId=int(r.gameId),playId=int(r.playId),mitad="confirmacion" if r.gameId in halves[1] else "desarrollo",
            situacion=dict(down=int(r.down),yardas=int(r.yardsToGo),yardas_a_goal=int(r.goal)),
            equipo=r.possessionTeam,defensa=r.defensiveTeam,formacion=r.offenseFormation,mariscal=r.displayName,
            cuarto=int(r.quarter),reloj=r.gameClock,local=r.homeTeamAbbr,visita=r.visitorTeamAbbr,
            puntos_local=int(r.preSnapHomeScore),puntos_visita=int(r.preSnapVisitorScore),
            desenlace=dict(yardas=int(r.playResult),alcanzo_distancia=bool(r.hit),pase=r.passResult,descripcion=r.playDescription),
            cuadros=None)
        plays[f"{r.gameId}/{r.playId}"]=play
    track_dir=data/"tracking"
    if track_dir.is_dir():
        inv,replays=inventory(track_dir,set(map(tuple,demo[KEY].to_numpy())))
        resumen["tracking"]["inventario"]=inv
        for key,frames in replays.items(): plays[key]["secuencia_observada"]=frames
        distances,pictures,missing=snap_data(track_dir,q,set(map(tuple,demo[KEY].to_numpy())))
        tr,te=[h.assign(separacion=[distances.get(key,np.nan) for key in h[KEY].itertuples(index=False,name=None)]).dropna(subset=["separacion"]) for h in (train,test)]
        info=resumen["tracking"]
        info.update(partidos_sin_archivo=missing,n_desarrollo=len(tr),n_confirmacion=len(te),sin_snap_valido=len(q)-len(tr)-len(te))
        for (gid,pid),picture in pictures.items(): plays[f"{gid}/{pid}"]["cuadros"]=picture
        if tr.gameId.nunique()>=5 and tr.hit.nunique()==2:
            cv=tr.copy()
            for fold in np.array_split(halves[0],5):
                held=cv.gameId.isin(fold)
                for col in ("solo","snap"):
                    design=features(cv.yardsToGo,cv.goal)[:,:2]
                    if col=="snap": design=np.column_stack([design,cv.separacion])
                    beta=fit(design[~held],cv.loc[~held,"hit"].to_numpy())
                    cv.loc[held,col]=(logistic(design[held] @ beta)-cv.loc[held,"hit"])**2
            cv["delta"]=cv.solo-cv.snap
            info["desarrollo_oof"]=dict(n=len(cv),partidos=int(cv.gameId.nunique()),mejora=cv.delta.mean(),ic95=interval(boots[0].rate(cv,"delta")))
        if tr.gameId.nunique()>=5 and te.gameId.nunique()>=5 and tr.hit.nunique()==2:
            losses={}
            for label in ("distancia","posiciones"):
                xx=[]
                for h in (tr,te):
                    design=features(h.yardsToGo,h.goal)[:,:2]
                    if label=="posiciones": design=np.column_stack([design,h.separacion])
                    xx.append(design)
                te["loss"]=(logistic(xx[1] @ fit(xx[0],tr.hit.to_numpy()))-te.hit)**2
                losses[label]=te.loss.copy()
                info["brier_"+label]=dict(valor=te.loss.mean(),ic95=interval(boots[1].rate(te,"loss")))
            te["delta"]=losses["distancia"]-losses["posiciones"]
            info.update(estado="evaluado",partidos_confirmacion=int(te.gameId.nunique()),brier_con_posiciones=info["brier_posiciones"]["valor"],
                        mejora_con_posiciones=te.delta.mean(),ic95_mejora=interval(boots[1].rate(te,"delta")))
    resumen["titular"]="En confirmación, las terceras de 1–3 yardas superaron a las de 7+." if all(m["corta_menos_larga"]["ic95"][0]>0 for m in resumen["mitades"].values()) else "Contraste por distancia sin confirmar."
    resumen["alternativas"]=["La defensa y las rutas elegidas cambian con la distancia pendiente.","Personal, quarterback, rival y marcador pueden influir en el contraste de formaciones."]
    resumen["ejemplos"]=[dict(gameId=v["gameId"],playId=v["playId"],mitad=v["mitad"]) for v in plays.values()]
    return dict(resumen=resumen,coef=coef.tolist(),coef_boot=coefs,celdas=cells,jugadas=plays,equipos=sorted(train.possessionTeam.unique()))


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--data",type=Path,default=HERE.parent/"data")
    parser.add_argument("--out",type=Path,default=HERE/"modelo.json")
    args=parser.parse_args()
    result=build(args.data)
    raw=json.dumps(result,ensure_ascii=False,allow_nan=False,separators=(",",":"))
    with NamedTemporaryFile(mode="w",encoding="utf-8",dir=args.out.parent,delete=False) as f:
        f.write(raw)
    Path(f.name).replace(args.out)
