"""Encode native Higgsedit frames with Higgsfield voice, then add chapters."""
from pathlib import Path
import concurrent.futures, json, subprocess

root=Path('/home/user/tutorial');m=json.loads((root/'manifest.json').read_text())
def encode(c):
    idx=c['index'];n=sum(2 if s['crop'] else 1 for s in c['shots']);frames=round(c['duration']*24);schedule=[]
    for i in range(n):
        count=round((i+1)*frames/n)-round(i*frames/n)
        schedule.extend([f"file '{root}/project/renders/{idx}-{i}.png'",f'duration {count/24:.9f}'])
    schedule.append(f"file '{root}/project/renders/{idx}-{n-1}.png'")
    source=root/'clips'/f'{idx:02d}.ffconcat';source.write_text('\n'.join(schedule)+'\n')
    out=root/'clips'/f'{idx:02d}.mp4'
    subprocess.run(['ffmpeg','-y','-v','error','-safe','0','-f','concat','-i',str(source),'-i',str(root/'audio'/f'{idx:02d}-final.wav'),'-map','0:v','-map','1:a','-r','24','-t',str(c['duration']),'-c:v','libx264','-preset','veryfast','-tune','stillimage','-crf','19','-pix_fmt','yuv420p','-threads','2','-c:a','aac','-b:a','128k','-ar','48000','-movflags','+faststart',str(out)],check=True)
    print('Encoded',idx,flush=True)

list(concurrent.futures.ThreadPoolExecutor(3).map(encode,m['chapters']))
listing=root/'clips/all.ffconcat';listing.write_text('\n'.join("file '%s/clips/%02d.mp4'" % (root,c['index']) for c in m['chapters'])+'\n')
subprocess.run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(listing),'-i',str(root/'chapters.ffmeta'),'-map_metadata','1','-map_chapters','1','-c','copy','-movflags','+faststart',str(root/'Tutoriel-Agent-Chantier-Cillian.mp4')],check=True)
print(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration,size','-of','json',str(root/'Tutoriel-Agent-Chantier-Cillian.mp4')]).decode())
