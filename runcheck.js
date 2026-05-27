
global.window = global;
global.window.addEventListener = function(){};
global.console = console;
global.alert = function(msg){ console.log('ALERT', msg); };
global.confirm = function(){ return false; };
global.localStorage = {getItem(){return null}, setItem(){}, removeItem(){}};
global.URL = {createObjectURL(){return 'blob:x'}, revokeObjectURL(){}};
global.Blob = function(){};
global.location = { reload(){ console.log('reload') }, origin:'http://localhost' };
class DummyEl {
  constructor(id){ this.id=id; this.classList={remove(){}, add(){}}; this.style={}; this.children=[]; this.options=[]; this.selectedIndex=-1; this.value=''; this.dataset={}; }
  addEventListener(){}
  appendChild(o){ this.children.push(o); this.options.push(o); }
  removeChild(){}
  click(){}
  focus(){}
  set innerHTML(v){ this._innerHTML=v; this.options=[]; }
  get innerHTML(){ return this._innerHTML || ''; }
}
const els = {};
global.document = {
  body: new DummyEl('body'),
  getElementById(id){ return els[id] || (els[id]=new DummyEl(id)); },
  querySelectorAll(sel){ return [new DummyEl('admin')]; },
  createElement(tag){ return new DummyEl(tag); },
  addEventListener(){}
};
global.supabaseClient = {
  auth: { onAuthStateChange(){} },
  from(){ return { select(){ return this }, order(){ return this }, eq(){ return this }, gt(){ return this }, in(){ return this }, update(){ return this }, delete(){ return this }, neq(){ return this }, insert(){ return this }, upsert(){ return this }, limit(){return this}, maybeSingle(){ return Promise.resolve({data:null,error:null}) }, then(resolve){ resolve({data:[],error:null}) } } },
  rpc(){ return Promise.resolve({data:null,error:null}) }
};
global.supabase = { createClient(){ return global.supabaseClient; } };
global.jspdf = { jsPDF: function(){ return { internal:{pageSize:{getWidth(){return 210}}}, setFontSize(){}, text(){}, line(){}, addPage(){}, save(){}, addImage(){}} } };
global.XLSX = {};
global.Image = function(){ setTimeout(()=>{ if(this.onload) this.onload(); },0); };

console.log('LOADING js/core/config.js');
require('./js/core/config.js');

console.log('LOADING js/core/config.js');
require('./js/core/config.js');

console.log('LOADING js/core/moduler.js');
require('./js/core/moduler.js');

console.log('LOADING js/core/state.js');
require('./js/core/state.js');

console.log('LOADING js/navigation.js');
require('./js/navigation.js');

console.log('LOADING js/auth.js');
require('./js/auth.js');

console.log('LOADING js/kunder.js');
require('./js/kunder.js');

console.log('LOADING js/prosjekter.js');
require('./js/prosjekter.js');

console.log('LOADING js/ansatte.js');
require('./js/ansatte.js');

console.log('LOADING js/firma.js');
require('./js/firma.js');

console.log('LOADING js/timer.js');
require('./js/timer.js');

console.log('LOADING js/utils.js');
require('./js/utils.js');

console.log('LOADING js/fakturaData.js');
require('./js/fakturaData.js');

console.log('LOADING js/pdfLayout.js');
require('./js/pdfLayout.js');

console.log('LOADING js/fakturaPdf.js');
require('./js/fakturaPdf.js');

console.log('LOADING js/faktura.js');
require('./js/faktura.js');

console.log('LOADING js/okonomi.js');
require('./js/okonomi.js');

console.log('LOADING js/fakturaValg.js');
require('./js/fakturaValg.js');

console.log('LOADING js/backup.js');
require('./js/backup.js');

console.log('LOADING js/lonn.js');
require('./js/lonn.js');

console.log('LOADING js/tester.js');
require('./js/tester.js');

console.log('LOADING js/varer.js');
require('./js/varer.js');

console.log('LOADING js/app.js');
require('./js/app.js');
