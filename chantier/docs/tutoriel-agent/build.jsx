// Native Higgsedit composition. Input screenshots are real n8n UI captures.
import fs from 'node:fs';
export default async ({ project }) => {
  const m=JSON.parse(fs.readFileSync('/home/user/tutorial/manifest.json','utf8'));
  const p=await project({dir:'/home/user/tutorial/project',size:'1920x1080',fps:24,background:'#101e2b'});
  for(const c of m.chapters){
    const audio=await p.add(`/home/user/tutorial/audio/${String(c.index).padStart(2,'0')}-final.wav`);
    p.cut(audio,{at:c.start,dur:c.duration});
    const layouts=c.shots.flatMap((s,i)=>s.crop?[{path:`/home/user/tutorial/images/${c.index}-${i}.png`,detail:false},{path:`/home/user/tutorial/images/${c.index}-${i}-crop.png`,detail:true}]:[{path:`/home/user/tutorial/images/${c.index}-${i}.png`,detail:false}]);
    const slot=c.duration/layouts.length;
    for(let i=0;i<layouts.length;i++){
      const shot=layouts[i],handle=await p.add(shot.path);
      const maxW=shot.detail?780:1384,maxH=835;
      const ratio=Math.min(maxW/handle.width,maxH/handle.height),w=handle.width*ratio,h=handle.height*ratio;
      const px=shot.detail?110:30,py=150+(835-h)/2;
      const pointX=shot.detail?950:1470,pointW=shot.detail?830:390;
      const slideName=`${c.index}-${i}`;
      p.compose(<frame width={1920} height={1080} layout="none" clip={true} origin="top-left">{[
        <rect x={0} y={0} width={1920} height={1080} fill="#101e2b" />,
        <rect x={0} y={0} width={1920} height={7} fill="#66e1b8" />,
        <text x={36} y={28} width={1800} height={35} fontFamily="Inter" fontSize={23} fontWeight={600} color="#66e1b8">L’ATELIER · AGENT ACHATS CHANTIER</text>,
        <text x={36} y={73} width={1790} height={60} fontFamily="Inter" fontSize={38} fontWeight={700} color="#ffffff">{c.title}</text>,
        <rect x={px-8} y={py-8} width={w+16} height={h+16} fill="#ffffff" radius={10}/>,
        <media file={handle} x={px} y={py} width={w} height={h} fit="contain" />,
        <text x={pointX} y={shot.detail?165:190} width={pointW} height={55} fontFamily="Inter" fontSize={24} fontWeight={700} color="#66e1b8">À EXPLIQUER À L’ORAL</text>,
        ...c.points.flatMap((point,j)=>[
          <rect x={pointX} y={(shot.detail?245:280)+j*190} width={7} height={110} fill={j===i%3?'#66e1b8':'#405467'} radius={3}/>,
          <text x={pointX+24} y={(shot.detail?246:281)+j*190} width={pointW-34} height={160} fontFamily="Inter" fontSize={shot.detail?34:27} lineHeight={1.25} fontWeight={j===i%3?700:400} color="#f1f5f8">{point}</text>
        ]),
        <rect x={36} y={1025} width={1848*(c.index/13)} height={3} fill="#66e1b8" />,
        <text x={36} y={1040} width={1550} height={28} fontFamily="Inter" fontSize={19} color="#a8bac7">{shot.detail?'Configuration réelle · détail agrandi':'Captures réelles de n8n'} · Voix de synthèse Cillian / Higgsfield</text>,
        <text x={1720} y={1038} width={164} height={30} fontFamily="Inter" fontSize={23} fontWeight={600} align="right" color="#f1f5f8">{`${String(c.index).padStart(2,'0')} / 13`}</text>
      ]}</frame>,{at:c.start+i*slot,dur:slot,name:slideName});
      await p.frame(c.start+i*slot+0.1,`renders/${slideName}.png`);
    }
  }
  fs.writeFileSync('/home/user/tutorial/timeline.json',JSON.stringify(await p.read(),null,2));
};
