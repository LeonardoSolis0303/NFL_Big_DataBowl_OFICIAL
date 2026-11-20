"""Optional snap features. Reads one game at a time; coordinates are in yards."""
from pathlib import Path
import numpy as np
import pandas as pd


def snap_data(directory: Path, cohort, example_keys):
    distances = {}
    pictures = {}
    missing_games = []
    for game_id, plays in cohort.groupby("gameId"):
        path = directory / f"tracking_{game_id}.csv"
        if not path.exists():
            missing_games.append(int(game_id))
            continue
        columns = ["gameId","playId","frameId","nflId","team","playDirection","x","y","event"]
        frames = pd.read_csv(path, usecols=columns)
        if not frames.gameId.eq(game_id).all():
            raise ValueError(f"gameId inesperado en {path.name}")
        tags = frames.loc[frames.event.eq("ball_snap"), ["playId","frameId"]].drop_duplicates()
        tags = tags.loc[~tags.playId.duplicated(keep=False)]
        snaps = frames.merge(tags, on=["playId","frameId"], validate="m:1")
        snaps = snaps.merge(plays[["playId","possessionTeam","defensiveTeam","nflId"]].rename(columns={"nflId":"qbId"}),on="playId",validate="m:1")
        for play_id, snap in snaps.groupby("playId"):
            athletes = snap[snap.nflId.notna()].copy()
            if athletes.empty or athletes.nflId.duplicated().any():
                continue
            defense = athletes[athletes.team.eq(athletes.defensiveTeam)]
            qb = athletes[athletes.nflId.eq(athletes.qbId)&athletes.team.eq(athletes.possessionTeam)]
            if len(qb)!=1 or len(defense)!=11 or len(athletes)!=22:
                continue
            coords = athletes[["x","y"]]
            if not (coords.x.between(0,120)&coords.y.between(-.1,53.5)).all():
                continue
            if athletes.playDirection.nunique()!=1 or athletes.playDirection.iloc[0] not in ("left","right"):
                continue
            key = (int(game_id),int(play_id))
            distances[key] = float(np.hypot(defense.x-qb.x.iloc[0],defense.y-qb.y.iloc[0]).min())
            if key in example_keys:
                if athletes.playDirection.iloc[0]=="left":
                    athletes["x"]=120-athletes.x
                    athletes["y"]=160/3-athletes.y
                pictures[key]=[dict(frameId=int(athletes.frameId.iloc[0]),evento="ball_snap",direccion="derecha",
                                     jugadores=[dict(nflId=int(r.nflId),equipo=r.team,x=r.x,y=r.y) for r in athletes.itertuples()])]
    return distances,pictures,missing_games
