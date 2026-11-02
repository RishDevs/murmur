const canvas=document.querySelector('canvas'), ctx=canvas.getContext('2d');
let state={groups:[],phase:'idle',status:'OFFLINE'}, previous=state, changedAt=performance.now(), migrations=[];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const birdsPerVoter=7;
const hash=s=>{let n=2166136261; for(const c of s) n=Math.imul(n^c.charCodeAt(0),16777619); return n>>>0;};
const rnd=(s,n)=>((hash(s+':'+n)%10000)/10000);
function locations(groups) { const p={}; groups.slice(0,5).forEach((g,i)=>{p[g.answer]=i===0?{x:960,y:550,size:112}:{x:[410,1510,680,1240][i-1],y:[790,790,880,880][i-1],size:46};}); return p; }
new EventSource('/events').onmessage=e=>{const data=JSON.parse(e.data), now=performance.now(); previous=state; state=data.state; changedAt=now; if(data.event?.type==='migrate') { const from=locations(previous.groups)[data.event.from] || {x:960,y:600}, to=locations(state.groups)[data.event.to] || {x:960,y:600}; migrations.push({...data.event,fromPos:from,toPos:to,start:now}); } };
function text(t,x,y,size,color='#F3E9DC',align='left',style='') {ctx.fillStyle=color;ctx.font=`${style} ${size}px "Iowan Old Style", Palatino, Georgia, serif`;ctx.textAlign=align;ctx.fillText(t,x,y);}
function bird(x,y,size,phase,opacity=1) {ctx.save();ctx.globalAlpha=opacity;ctx.strokeStyle='#0E0F14';ctx.lineWidth=2.6;ctx.lineCap='round';ctx.beginPath();const flap=Math.sin(phase)*size*.5;ctx.moveTo(x-size,y-flap);ctx.lineTo(x,y);ctx.lineTo(x+size,y-flap);ctx.stroke();ctx.restore();}
function draw(now) {
 const dpr=devicePixelRatio||1, w=canvas.clientWidth,h=canvas.clientHeight; if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);} ctx.setTransform(canvas.width/1920,0,0,canvas.height/1080,0,0);
 const sky=ctx.createLinearGradient(0,0,0,1080);sky.addColorStop(0,'#141826');sky.addColorStop(.58,'#34303a');sky.addColorStop(1,'#C9714A');ctx.fillStyle=sky;ctx.fillRect(0,0,1920,1080);
 ctx.fillStyle='#171923';ctx.beginPath();ctx.moveTo(0,1020);ctx.bezierCurveTo(300,995,480,1038,730,1016);ctx.bezierCurveTo(1010,988,1240,1038,1500,1005);ctx.bezierCurveTo(1700,990,1820,1017,1920,1003);ctx.lineTo(1920,1080);ctx.lineTo(0,1080);ctx.fill();
 text('M U R M U R',64,74,24,'#F3E9DC'); text(state.question||'A question is waiting in the wings.',64,137,40,'#F3E9DC','left','italic');
 const loc=locations(state.groups), active=migrations.filter(m=>now-m.start<(reduced.matches?350:1600));migrations=active;
 if(!state.groups.length) {text(state.phase==='idle'?'Waiting for the next question':state.phase==='paused'?'Paused':'Type your answer in chat',960,580,48,'#F3E9DC','center','italic'); if(state.phase==='idle') for(let i=0;i<5;i++) bird(760+i*105,420+Math.sin(now/2400+i)*10,6,now/350+i,.55);}
 for(const [i,g] of state.groups.slice(0,5).entries()) {
   const target=loc[g.answer], prior=locations(previous.groups)[g.answer] || target, progress=reduced.matches?1:Math.min(1,(now-changedAt)/600), mix=progress*progress*(3-2*progress), p={x:prior.x+(target.x-prior.x)*mix,y:prior.y+(target.y-prior.y)*mix,size:prior.size+(target.size-prior.size)*mix}, isLead=i===0, alpha=Math.min(1,(now-changedAt)/600+.4); ctx.save(); ctx.globalAlpha=alpha;
   const label=g.answer.toLocaleUpperCase(); let size=p.size; ctx.font=`${size}px Georgia`; while(ctx.measureText(label+' · '+g.count).width>(isLead?1150:570)&&size>30){size-=2;ctx.font=`${size}px Georgia`;}
   text(label+' · '+g.count,p.x,p.y+116,size,'#F3E9DC','center');
   if(isLead){ctx.fillStyle='#E8A15A';const width=Math.min(560,ctx.measureText(label+' · '+g.count).width);ctx.fillRect(p.x-width/2,p.y+142,width,4);}
   g.voters.forEach((v,vi)=>{const migrating=active.find(m=>m.userId===v.id); if(migrating&&!reduced.matches)return;for(let j=0;j<birdsPerVoter;j++){const seed=v.id+g.answer;const x=p.x+(rnd(seed,j)*2-1)*(isLead?260:150),y=p.y-90+(rnd(seed,j+20)*2-1)*(isLead?95:65);bird(x+Math.sin(now/1800+j)*5,y+Math.cos(now/2200+j)*4,5+rnd(seed,j+40)*3,now/220+j+vi);}});ctx.restore();
 }
 if(state.groups.length>5) text(`+${state.groups.length-5} more`,960,979,29,'#F3E9DC','center');
 for(const m of active){const t=Math.min(1,(now-m.start)/(reduced.matches?350:1600)),ease=t*t*(3-2*t),x=m.fromPos.x+(m.toPos.x-m.fromPos.x)*ease,y=m.fromPos.y-90+(m.toPos.y-m.fromPos.y)*ease-Math.sin(Math.PI*t)*180;if(!reduced.matches){ctx.strokeStyle='#E8A15A';ctx.globalAlpha=.65*(1-t);ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-60,y+15);ctx.quadraticCurveTo(x-25,y-10,x,y);ctx.stroke();ctx.globalAlpha=1;for(let j=0;j<birdsPerVoter;j++)bird(x-j*12,y+Math.sin(j)*10,7,now/170+j);}text(`${m.name} changed their mind`,960,245,30,'#F3E9DC','center','italic');}
 if(state.phase==='paused') text('PAUSED',1856,85,26,'#F3E9DC','right');
 if(state.demo) {ctx.save();ctx.translate(1750,185);ctx.rotate(-.12);ctx.strokeStyle='#8F3030';ctx.lineWidth=5;ctx.strokeRect(-130,-30,260,52);text('SIMULATED',0,8,29,'#8F3030','center');ctx.restore();}
 ctx.fillStyle=state.status==='LIVE'?'#F3E9DC':'#E8A15A';ctx.beginPath();ctx.arc(1480,1032,6,0,Math.PI*2);ctx.fill();text(state.status==='SIMULATED'?'SIMULATED':state.status,1500,1041,22,'#F3E9DC');text('Chat’s opinion — not a fact.',1856,1041,24,'#F3E9DC','right');
 requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
