"""Reproducible inventory and selected replays from official tracking CSVs."""
from collections import Counter
from pathlib import Path
import pandas as pd

EVENTS = ("ball_snap", "pass_forward", "pass_arrived", "pass_outcome_caught",
          "pass_outcome_incomplete", "qb_sack")
KEY = ["gameId", "playId"]


def inventory(directory, examples):
    counts = Counter()
    found = set()
    replays = {}
    for path in sorted(Path(directory).glob("tracking_*.csv")):
        g=pd.read_csv(path,usecols=KEY+["frameId","nflId","team","playDirection","x","y","event"])
        counts["archivos"] += 1
        counts["filas"] += len(g)
        counts["clave_duplicada"] += int(g.duplicated(KEY+["frameId","nflId"]).sum())
        found.update(g[KEY].drop_duplicates().itertuples(index=False,name=None))
        tags=g.loc[g.event.isin(EVENTS),KEY+["event"]].drop_duplicates()
        counts.update(tags.event.value_counts().to_dict())
        for gid,pid in examples:
            if int(path.stem.split("_")[-1])!=gid:
                continue
            q=g[g.playId.eq(pid)].copy()
            left=q.playDirection.eq("left")
            q.loc[left,"x"]=120-q.loc[left,"x"]
            q.loc[left,"y"]=160/3-q.loc[left,"y"]
            frames=[]
            for frame,rows in q.groupby("frameId"):
                ball=rows[rows.team=="football"]
                players=rows[rows.nflId.notna()]
                frames.append(dict(frameId=int(frame),eventos=sorted(rows.event.dropna().unique()),
                    balon=None if len(ball)!=1 else [round(float(ball.iloc[0].x),3),round(float(ball.iloc[0].y),3)],
                    jugadores=[[int(r.nflId),r.team,round(r.x,3),round(r.y,3)] for r in players.itertuples()]))
            if frames: replays[f"{gid}/{pid}"]=frames
    return {**counts,"jugadas":len(found)},replays
