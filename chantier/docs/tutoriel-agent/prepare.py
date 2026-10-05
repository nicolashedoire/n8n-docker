"""Recoverable media ingress and exact timing for the Higgsfield montage."""
from pathlib import Path
import concurrent.futures, json, math, subprocess, urllib.request
from PIL import Image

root=Path('/home/user/tutorial')
m=json.loads((root/'manifest.json').read_text())
for folder in ['images','audio','clips','project/renders']:(root/folder).mkdir(parents=True,exist_ok=True)

def prepare(c):
    idx=c['index']; audio=root/'audio'/f'{idx:02d}.wav'
    if not audio.exists():urllib.request.urlretrieve(c['audio'],audio)
    final=root/'audio'/f'{idx:02d}-final.wav'
    subprocess.run(['ffmpeg','-y','-v','error','-i',str(audio),'-af',f'atempo={m["voice_speed"]},adelay=500,apad','-t',str(c['duration']),'-ar','48000',str(final)],check=True)
    for n,shot in enumerate(c['shots']):
        target=root/'images'/f'{idx}-{n}.png'
        urllib.request.urlretrieve(shot['url'],target)
        if shot['crop']:Image.open(target).crop(shot['crop']).save(root/'images'/f'{idx}-{n}-crop.png')
    print('Prepared',idx,flush=True)

list(concurrent.futures.ThreadPoolExecutor(4).map(prepare,m['chapters']))

chapters=[';FFMETADATA1']; report=[]
for c in m['chapters']:
    chapters += ['[CHAPTER]','TIMEBASE=1/1000',f'START={round(c["start"]*1000)}',f'END={round((c["start"]+c["duration"])*1000)}','title='+c['title']]
    start=round(c['start']); report.append(f'{start//60:02d}:{start%60:02d} — {c["title"]}')
(root/'chapters.ffmeta').write_text('\n'.join(chapters)+'\n')
(root/'chapters.txt').write_text('\n'.join(report)+'\n')
print('Duration',m['duration'],flush=True)
