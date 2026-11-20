// Tests des permissions PocketBase.
// ⚠️ À lancer UNIQUEMENT sur une base de TEST (crée puis supprime 2 comptes).
// PB_URL=http://127.0.0.1:8091 PB_SUPERUSER_EMAIL=... PB_SUPERUSER_PASSWORD=... npm run test:permissions
import PocketBase from 'pocketbase';
const U=process.env.PB_URL||'http://127.0.0.1:8090';
const admin=new PocketBase(U); await admin.collection('_superusers').authWithPassword(process.env.PB_SUPERUSER_EMAIL,process.env.PB_SUPERUSER_PASSWORD);
const mk=async(e)=>{try{await admin.collection('users').create({email:e,password:'Password-123',passwordConfirm:'Password-123'})}catch{};const p=new PocketBase(U);await p.collection('users').authWithPassword(e,'Password-123');return p;};
const A=await mk('a@t.fr'), B=await mk('b@t.fr');
const ok=(n,c)=>console.log((c?'✓':'✗'),n);
const aid=A.authStore.record.id, bid=B.authStore.record.id;
const catA=await A.collection('categories').create({owner:aid,name:'École',color:'#aabbcc'});
const pA=await A.collection('projects').create({owner:aid,name:'P',status:'todo'});
const tA=await A.collection('tasks').create({owner:aid,title:'T',priority:'normal',status:'todo',project:pA.id,category:catA.id,deadline:'2026-11-20'});
ok('A crée tâche liée à son projet', !!tA.id);
let r; try{await B.collection('tasks').create({owner:aid,title:'x',priority:'normal',status:'todo'});r=false}catch{r=true} ok('B ne peut pas créer pour A',r);
try{await B.collection('tasks').create({owner:bid,title:'x',priority:'normal',status:'todo',project:pA.id});r=false}catch{r=true} ok('B ne peut pas lier au projet de A',r);
ok('B ne voit pas les tâches de A', (await B.collection('tasks').getFullList()).length===0);
try{await B.collection('tasks').getOne(tA.id);r=false}catch{r=true} ok('B ne lit pas la tâche de A par id',r);
try{await B.collection('tasks').update(tA.id,{title:'pirate'});r=false}catch{r=true} ok('B ne modifie pas la tâche de A',r);
try{await B.collection('tasks').delete(tA.id);r=false}catch{r=true} ok('B ne supprime pas la tâche de A',r);
try{await A.collection('tasks').update(tA.id,{owner:bid});r=false}catch{r=true} ok('A ne peut pas changer de propriétaire',r);
const anon=new PocketBase(U); try{const l=await anon.collection('tasks').getFullList(); r=l.length===0}catch{r=true} ok('anonyme ne voit rien',r);
try{await anon.collection('tasks').create({owner:aid,title:'x',priority:'normal',status:'todo'});r=false}catch{r=true} ok('anonyme ne crée rien',r);
try{await A.collection('tasks').create({owner:aid,title:'x',priority:'normal',status:'todo',deadline:'20/11/2026'});r=false}catch{r=true} ok('date invalide refusée',r);
try{await A.collection('transactions').create({owner:aid,type:'expense',amount_cents:12.5,currency:'EUR',date:'2026-11-16',status:'confirmed'});r=false}catch{r=true} ok('montant non entier refusé',r);
const rec=await A.collection('recurring_transactions').create({owner:aid,label:'Loyer',type:'expense',amount_cents:48000,currency:'EUR',frequency:'monthly',interval:1,start_date:'2026-01-01',active:true});
await A.collection('transactions').create({owner:aid,type:'expense',amount_cents:48000,currency:'EUR',date:'2026-12-01',status:'planned',recurring:rec.id,due_key:'2026-12-01'});
try{await A.collection('transactions').create({owner:aid,type:'expense',amount_cents:48000,currency:'EUR',date:'2026-12-01',status:'planned',recurring:rec.id,due_key:'2026-12-01'});r=false}catch{r=true} ok('doublon de récurrence refusé',r);
await A.collection('projects').delete(pA.id); const t2=await A.collection('tasks').getOne(tA.id); ok('suppression projet → tâche conservée sans projet', t2.project==='');
await admin.collection('users').delete(bid);
await admin.collection('users').delete(aid);

