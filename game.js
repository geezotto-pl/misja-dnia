/* Misja Dnia: gra (misje dzienne, tryb testera, mapa, dowody, punkty, dziennik) */
"use strict";
var APP_VER="13.11 15:30";
var BASE=null;
var LV={E:{n:"Łatwa",mode:"Łatwy",mult:.8},N:{n:"Normalna",mode:"Normalny",mult:1},H:{n:"Trudna",mode:"Trudny",mult:1.25},X:{n:"Hero",mode:"Hero",mult:1.5}};
var LVORD=["E","N","H","X"];
var KAT={ludzie:"🗣️ Ludzie",relacje:"❤️ Relacje",ruch:"🥾 Ruch",telefon:"📵 Mniej telefonu",nauka:"📖 Umysł i nauka",kreat:"🎨 Kreatywność",okolica:"🧭 Przygoda i okolica",porzadek:"🧹 Porządek"};
var DOWOD={zdjecie:"📷 zdjęcie",zrzut:"🖼️ zrzut ekranu",notatka:"✍️ notatka",stoper:"⏱️ stoper",gps:"📍 GPS na miejscu"};
var AVOIDMAP={jedzenie:"food",dzwonienie:"phone",zakupy:"shop",wieczor:"evening"};
var MAPKM={pieszo:[1,2,4,7,10],"pieszo-daleko":[1,2,4,7,10],rower:[4,7,10,14,20],bus:[2,3,5,8,12],wyprawa:[8,12,16,20,25],miejscowosc:[15,25,40,60,80]};
var MAPKIND={pieszo:"poi","pieszo-daleko":"poi",rower:"poi",bus:"bus",wyprawa:"poi",miejscowosc:"place"};
var TRAVEL={pieszo:"walking","pieszo-daleko":"walking",rower:"bicycling",bus:"transit",wyprawa:"driving",miejscowosc:"driving"};
var DIRS=["na północ","na północny wschód","na wschód","na południowy wschód","na południe","na południowy zachód","na zachód","na północny zachód"];

/* ---------- baza misji ---------- */
function loadBase(cb){
  fetch("misje.json",{cache:"no-cache"}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){
    BASE=j.misje;try{localStorage.setItem(KEY+"_base",JSON.stringify(BASE))}catch(e){}cb()
  }).catch(function(){try{BASE=JSON.parse(localStorage.getItem(KEY+"_base")||"null")}catch(e){}cb()});
}
function byId(id){for(var i=0;i<(BASE||[]).length;i++)if(BASE[i].id===id)return BASE[i];return null}

/* ---------- czas (z przesunięciem dla testera) ---------- */
function now(){return new Date(Date.now()+((D.g&&D.g.offset)||0)*864e5)}
function dkey(d){d=d||now();return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2)}
function mondayKey(d){d=new Date(d||now());d.setHours(12,0,0,0);var w=(d.getDay()+6)%7;d.setDate(d.getDate()-w);return dkey(d)}
function daysBetween(a,b){return Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/864e5)}
var DNI=["niedziela","poniedziałek","wtorek","środa","czwartek","piątek","sobota"];

/* ---------- warianty i poziomy ---------- */
function hasTransit(){return D.transit?D.transit==="yes":D.place!=="village"}
function allowed(e){
  var w=e.wym||[],has=D.has||[],av=D.avoid||[];
  if(w.indexOf("rower")>=0&&has.indexOf("bike")<0)return false;
  if(w.indexOf("auto")>=0&&has.indexOf("car")<0)return false;
  if(w.indexOf("pies")>=0&&has.indexOf("dog")<0)return false;
  if(w.indexOf("intens")>=0&&D.mobility&&D.mobility!=="none")return false;
  if(w.indexOf("koszt")>=0&&D.budget==="free")return false;
  for(var k in AVOIDMAP)if(w.indexOf(k)>=0&&av.indexOf(AVOIDMAP[k])>=0)return false;
  if(e.mapa==="wyprawa"&&has.indexOf("car")<0&&has.indexOf("bike")<0)return false;
  if(e.mapa==="bus"&&!hasTransit())return false;
  if(!e.mapa){var t=+(D.time||15);if(e.czas>Math.max(t*3,15))return false}
  return true;
}
function variants(e){
  var r=[{v:"b",i:e.i}];
  if((e.latwiej||e.mapa)&&e.i>1)r.push({v:"l",i:e.i-1});
  if((e.trudniej||e.mapa)&&e.i<5)r.push({v:"h",i:e.i+1});
  return r;
}
function effI(e,i,c){var dis=0;for(var k in e.w)dis+=e.w[k]*(10-c[k])/10;return i*(1+1.5*dis)}
function lvlOf(x){return x<3?"E":x<5?"N":x<8?"H":"X"}
function instText(e,v,hero){var t=hero&&e.hero?e.hero:v==="l"&&e.latwiej?e.latwiej:v==="h"&&e.trudniej?e.trudniej:e.t;return gtxt(t)}
function inst(mid,v){var e=byId(mid);if(!e)return null;var vs=variants(e).filter(function(x){return x.v===v})[0]||{v:"b",i:e.i};var c=comfort();var x=effI(e,vs.i,c),key=mid+"|"+vs.v,A0=D.g&&D.g.day&&D.g.act&&D.g.act[D.g.day.key+"|"+key];return{e:e,mid:mid,v:vs.v,i:vs.i,eff:x,lvl:lvlOf(x),key:key,hero:!!(A0&&A0.hero)}}
function kmI(I){var k=km(I.e,I.i);return I.hero?Math.round(k*1.5*10)/10:k}
function czasI(I){return I.hero&&I.e.heroCzas?I.e.heroCzas:I.e.czas}
function km(e,i){return MAPKM[e.mapa][Math.max(1,Math.min(5,i))-1]}

/* ---------- stan gry ---------- */
function G0(){return{offset:0,tester:false,xp:0,streak:0,lastDone:null,log:[],day:null,week:null,act:{},visited:[],known:[],sec:{},home:null,useHome:false,ctr:0}}
function startGame(){
  if(!D.comfort){D.comfort=comfort()}
  D.g=G0();D.uid=D.uid||Math.random().toString(36).slice(2,6);save();sendProfile();S.hist=[];go("weekpick",false);
}
function recent(days){var k=dkey(),r={};(D.g.log||[]).forEach(function(l){if(daysBetween(l.day,k)<days)r[l.mid]=1});return r}
function pickLevel(want,excl){
  var c=comfort(),rec=recent(30),pool=[];
  (BASE||[]).forEach(function(e){if(e.rytm!=="d"||!allowed(e)||rec[e.id]||excl[e.id])return;
    variants(e).forEach(function(vs){var x=effI(e,vs.i,c);if(lvlOf(x)===want)pool.push({mid:e.id,v:vs.v,eff:x,kat:e.kat})})});
  if(!pool.length&&want==="X"){var ph=pickLevel("H",excl);if(ph)ph.want="X";return ph}
  if(!pool.length)return null;
  if((D.goals||[]).length&&Math.random()<.6){var g=pool.filter(function(p){return D.goals.indexOf(p.kat)>=0});if(g.length)pool=g}
  // preferuj misje bez wariantów zastępczych tej samej misji
  var p=pool[Math.floor(Math.random()*pool.length)];return{mid:p.mid,v:p.v,want:want};
}
function modeLevel(){var m=(D.g.week&&D.g.week.mode)||"N",r=Math.random();
  if(m==="E")return "E";if(m==="N")return r<.25?"E":"N";if(m==="H")return r<.5?"N":"H";return "H"}
function ensureDay(){
  var k=dkey();
  if(D.g.day&&D.g.day.key===k&&D.g.day.tester===D.g.tester)return;
  var od=D.g.day;
  if(od&&od.key!==k&&od.hero&&od.done.indexOf(od.hero)<0&&!od.heroTester&&!od.penalized){var pen=Math.round((od.heroXP||0)*.4);od.penalized=true;
    if(pen>0){D.g.xp=Math.max(0,D.g.xp-pen);var pm=byId(od.hero.split("|")[0]);D.g.log.unshift({day:od.key,mid:od.hero.split("|")[0],v:"",key:od.hero,text:"Niewykonana misja Hero: "+(pm?gtxt(pm.hero||pm.t).replace("{cel}","…"):""),kat:pm?pm.kat:"ruch",lvl:"X",xp:-pen,kara:true,photos:[]});
      report("kara",{misja:od.hero,poziom:"Hero",ocena:"niewykonana",d:{kara:pen,dzien:od.key}});setTimeout(function(){toast("Misja Hero z "+fmtDate(new Date(od.key+"T12:00:00"))+" niewykonana: −"+pen+" XP")},600)}}
  var excl={},cands=[];
  var wants=D.g.tester?["E","N","H"]:[modeLevel()];
  wants.forEach(function(w){var p=pickLevel(w,excl);if(p){excl[p.mid]=1;cands.push(p)}else cands.push({mid:null,want:w})});
  D.g.day={key:k,tester:D.g.tester,cands:cands,swaps:0,done:[]};save();
}
function needWeek(){return !D.g.week||D.g.week.start!==mondayKey()}
function totalLevel(xp){var n=1;while(50*n*(n+1)<=xp)n++;return n}
function lvlFloor(n){return 50*n*(n-1)}

/* ---------- zdjęcia (IndexedDB) ---------- */
var _db=null;
function idb(){return new Promise(function(res,rej){if(_db)return res(_db);var r=indexedDB.open("misja-dnia",1);r.onupgradeneeded=function(){r.result.createObjectStore("p")};r.onsuccess=function(){_db=r.result;res(_db)};r.onerror=function(){rej(r.error)}})}
function pput(k,v){return idb().then(function(db){return new Promise(function(res,rej){var t=db.transaction("p","readwrite");t.objectStore("p").put(v,k);t.oncomplete=res;t.onerror=function(){rej(t.error)}})})}
function pget(k){return idb().then(function(db){return new Promise(function(res){var q=db.transaction("p").objectStore("p").get(k);q.onsuccess=function(){res(q.result)};q.onerror=function(){res(null)}})})}
function fillPhotos(){document.querySelectorAll("img[data-pk]").forEach(function(im){pget(im.getAttribute("data-pk")).then(function(v){if(v)im.src=v})})}
function compress(file,max){return new Promise(function(res,rej){var u=URL.createObjectURL(file),im=new Image();im.onload=function(){var s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement("canvas");c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext("2d").drawImage(im,0,0,c.width,c.height);URL.revokeObjectURL(u);res(c.toDataURL("image/jpeg",.72))};im.onerror=rej;im.src=u})}

/* ---------- geografia ---------- */
function hav(a,b,c,d){var R=6371000,t=Math.PI/180,x=(c-a)*t,y=(d-b)*t,h=Math.sin(x/2)*Math.sin(x/2)+Math.cos(a*t)*Math.cos(c*t)*Math.sin(y/2)*Math.sin(y/2);return 2*R*Math.asin(Math.sqrt(h))}
function brg(a,b,c,d){var t=Math.PI/180,y=Math.sin((d-b)*t)*Math.cos(c*t),x=Math.cos(a*t)*Math.sin(c*t)-Math.sin(a*t)*Math.cos(c*t)*Math.cos((d-b)*t);return(Math.atan2(y,x)/t+360)%360}
function sector(b){return Math.round(b/45)%8}
function dest(lat,lon,dist,b){var R=6371000,t=Math.PI/180,d=dist/R,br=b*t,la=lat*t,lo=lon*t;var la2=Math.asin(Math.sin(la)*Math.cos(d)+Math.cos(la)*Math.sin(d)*Math.cos(br));var lo2=lo+Math.atan2(Math.sin(br)*Math.sin(d)*Math.cos(la),Math.cos(d)-Math.sin(la)*Math.sin(la2));return{lat:la2/t,lon:lo2/t}}
function fmtKm(m){return m<1000?Math.round(m/10)*10+" m":(Math.round(m/100)/10).toString().replace(".",",")+" km"}
function getPos(){return new Promise(function(res,rej){if(!navigator.geolocation)return rej(new Error("Brak GPS w tym urządzeniu"));
  navigator.geolocation.getCurrentPosition(function(p){res({lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy})},function(e){rej(new Error(e.code===1?"Brak zgody na lokalizację. Włącz ją w ustawieniach przeglądarki.":"Nie udało się ustalić lokalizacji. Spróbuj na zewnątrz."))},{enableHighAccuracy:true,timeout:20000,maximumAge:30000})})}
function getStart(){if(D.g.useHome&&D.g.home)return Promise.resolve(D.g.home);return getPos().catch(function(err){if(D.g.home)return D.g.home;throw err})}
var OVERPASS=[["de","https://overpass-api.de/api/interpreter"],["coffee","https://overpass.private.coffee/api/interpreter"],["kumi","https://overpass.kumi.systems/api/interpreter"],["mailru","https://maps.mail.ru/osm/tools/overpass/api/interpreter"]];
var MAPDIAG=[];
function diag(t){MAPDIAG.unshift(new Date().toLocaleTimeString("pl-PL")+" "+t);MAPDIAG=MAPDIAG.slice(0,12)}
function fetchT(url,opt,ms){var ctl=window.AbortController?new AbortController():null,tm=setTimeout(function(){ctl&&ctl.abort()},ms);opt=opt||{};if(ctl)opt.signal=ctl.signal;
  return fetch(url,opt).then(function(r){clearTimeout(tm);return r},function(e){clearTimeout(tm);throw new Error(e&&e.name==="AbortError"?"czas":"sieć")})}
function overpass(q){
  return new Promise(function(res,rej){
    var left=OVERPASS.length,errs=[],doneF=false;
    OVERPASS.forEach(function(ep){
      fetchT(ep[1],{method:"POST",body:"data="+encodeURIComponent(q),headers:{"Content-Type":"application/x-www-form-urlencoded"}},15000)
        .then(function(r){if(!r.ok)throw new Error(String(r.status));return r.json().catch(function(){throw new Error("zły JSON")})})
        .then(function(j){if(doneF)return;doneF=true;diag("overpass "+ep[0]+": OK, "+(j.elements||[]).length+" obiektów");res(j.elements||[])})
        .catch(function(e){errs.push(ep[0]+": "+(e.message||"błąd"));if(--left===0&&!doneF){diag("overpass: "+errs.join(", "));var er=new Error("Serwery map nie odpowiadają ("+errs.join(", ")+").");er.all=true;rej(er)}});
    });
  });
}
/* zapasowe źródło: Nominatim (adres najbliżej punktu) */
function nominatim(lat,lon,zoom){
  var u="https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=pl&zoom="+zoom+"&lat="+lat.toFixed(5)+"&lon="+lon.toFixed(5);
  return fetchT(u,{headers:{"Accept":"application/json"}},15000).then(function(r){if(!r.ok)throw new Error("nominatim "+r.status);return r.json()}).then(function(j){if(!j||j.error||j.lat==null)throw new Error("nominatim: brak");diag("nominatim: OK");return j});
}
function nomName(j,kind){var a=j.address||{};var town=a.village||a.town||a.city||a.hamlet||a.suburb||"";
  if(kind==="place")return(town||j.name||"Miejscowość");
  var road=a.road||a.path||a.footway||a.track||"";
  return road?(road+(town?", "+town:"")):(j.name||town||"Punkt na mapie");}
function fallbackTarget(st,dist,kind){
  var tries=0;
  function attempt(){tries++;
    var s=chooseSector([0,1,2,3,4,5,6,7].map(function(i){return{sec:i}}));var b=s*45+(Math.random()*40-20);
    var p=dest(st.lat,st.lon,dist,b);
    return nominatim(p.lat,p.lon,kind==="place"?13:17).then(function(j){var la=+j.lat,lo=+j.lon,d=hav(st.lat,st.lon,la,lo);
      if(d<dist*.45||d>dist*1.7||nearUsed(la,lo,300)){D.g.sec[s]=D.g.ctr=(D.g.ctr||0)+1;if(tries<4)return attempt();throw new Error("Nie znalazłem celu. Spróbuj jeszcze raz.")}
      var ad=j.address||{},town=ad.village||ad.town||ad.city||ad.hamlet||ad.suburb||"";
      return{lat:la,lon:lo,loc:kind==="place"?"":town,name:kind==="place"?nomName(j,kind):((ad.road||ad.path||ad.track||"Punkt na mapie")+(kind==="bus"?" (wysiądź na przystanku najbliżej)":" (sprawdź, co tam jest)")),d:d,sec:sector(brg(st.lat,st.lon,la,lo)),start:{lat:st.lat,lon:st.lon},road:true,src:"nominatim"}})
    .catch(function(e){if(tries<4&&/nominatim: brak/.test(e.message))return attempt();diag("nominatim: "+e.message);throw new Error("Mapy chwilowo nie działają ("+e.message+"). Spróbuj za kilka minut.")});
  }
  return attempt();
}
function poiQuery(kind,lat,lon,r){
  var a="(around:"+Math.round(r)+","+lat.toFixed(5)+","+lon.toFixed(5)+")";
  if(kind==="bus")return "[out:json][timeout:25];node[highway=bus_stop]"+a+";out 500;";
  if(kind==="place")return "[out:json][timeout:25];node[place~\"^(village|town|hamlet)$\"]"+a+";out 800;";
  return "[out:json][timeout:25];(nwr[tourism~\"^(viewpoint|attraction|artwork|picnic_site)$\"]"+a+";nwr[historic]"+a+";nwr[amenity~\"^(place_of_worship|fountain)$\"]"+a+";nwr[leisure~\"^(park|nature_reserve)$\"][name]"+a+";nwr[natural~\"^(water|peak|spring)$\"][name]"+a+";nwr[man_made~\"^(tower|water_tower|lighthouse)$\"]"+a+";node[natural=tree][denotation]"+a+";);out center 600;";
}
function label(t){
  var L="Ciekawe miejsce";
  if(t.highway==="bus_stop")L="Przystanek";
  else if(t.place)L=t.place==="town"?"Miasto":t.place==="village"?"Wieś":"Osada";
  else if(t.tourism==="viewpoint")L="Punkt widokowy";else if(t.tourism==="artwork")L="Dzieło sztuki / mural";else if(t.tourism==="picnic_site")L="Miejsce piknikowe";else if(t.tourism==="attraction")L="Atrakcja";
  else if(t.historic){L={wayside_shrine:"Kapliczka",wayside_cross:"Krzyż przydrożny",memorial:"Miejsce pamięci",monument:"Pomnik",castle:"Zamek",ruins:"Ruiny",church:"Zabytkowy kościół",manor:"Dwór",archaeological_site:"Stanowisko archeologiczne",tomb:"Grób historyczny",milestone:"Kamień milowy"}[t.historic]||"Zabytek"}
  else if(t.amenity==="place_of_worship")L="Kościół / kaplica";else if(t.amenity==="fountain")L="Fontanna";
  else if(t.leisure==="park")L="Park";else if(t.leisure==="nature_reserve")L="Rezerwat przyrody";
  else if(t.natural==="water")L="Staw / jezioro";else if(t.natural==="peak")L="Wzniesienie";else if(t.natural==="spring")L="Źródło";else if(t.natural==="tree")L="Pomnik przyrody (drzewo)";
  else if(t.man_made==="water_tower")L="Wieża ciśnień";else if(t.man_made)L="Wieża";
  if(!t.name)return L;var n=t.name.toLowerCase(),l=L.toLowerCase().split(/[ \/(]/)[0];return n.indexOf(l)>=0?t.name:t.name+" ("+L.toLowerCase()+")";
}
function nearUsed(lat,lon,r){var all=(D.g.visited||[]).concat(D.g.known||[]);for(var i=0;i<all.length;i++)if(hav(lat,lon,all[i].lat,all[i].lon)<r)return true;return false}
function chooseSector(list){ // list: elementy z .sec
  var secs={};list.forEach(function(x){secs[x.sec]=1});
  var best=null,bv=Infinity;Object.keys(secs).forEach(function(s){var v=D.g.sec[s]==null?-1:D.g.sec[s];if(v<bv||(v===bv&&Math.random()<.5)){bv=v;best=+s}});
  return best;
}
function sleep(ms){return new Promise(function(r){setTimeout(r,ms)})}
var NOMKW={poi:["viewpoint","wayside shrine","monument","memorial","church","park","castle","ruins","attraction","artwork","lake","tower","fountain","chapel"],bus:["bus stop"]};
function nominatimPOI(st,dist,kind){
  var kws=(NOMKW[kind]||[]).slice().sort(function(){return Math.random()-.5}).slice(0,kind==="poi"?5:1);
  var r=dist*1.5,dLat=r/111320,dLon=r/(111320*Math.cos(st.lat*Math.PI/180));
  var vb=(st.lon-dLon).toFixed(4)+","+(st.lat+dLat).toFixed(4)+","+(st.lon+dLon).toFixed(4)+","+(st.lat-dLat).toFixed(4);
  var out=[],seen={};
  return kws.reduce(function(pr,kw,ix){return pr.then(function(){return(ix?sleep(1100):Promise.resolve()).then(function(){
      var u="https://nominatim.openstreetmap.org/search?format=jsonv2&accept-language=pl&limit=40&bounded=1&viewbox="+vb+"&q="+encodeURIComponent("["+kw+"]");
      return fetchT(u,{headers:{"Accept":"application/json"}},12000).then(function(x){if(!x.ok)throw new Error(String(x.status));return x.json()}).then(function(arr){
        (arr||[]).forEach(function(j){var k=j.osm_type+j.osm_id;if(seen[k])return;seen[k]=1;var t={};t[j.category]=j.type;if(j.name)t.name=j.name;out.push({lat:+j.lat,lon:+j.lon,tags:t})});
      }).catch(function(e){diag("nominatim ["+kw+"]: "+e.message)});
    })})},Promise.resolve()).then(function(){diag("nominatim szukanie: "+out.length+" miejsc");return out});
}
var LASTLIST=[];
function nearbyFrom(t,list){var seen={},out=[];
  (list||[]).forEach(function(x){if(x.tags&&x.tags.highway==="bus_stop")return;var d=hav(t.lat,t.lon,x.lat,x.lon);if(d<25||d>1000)return;
    var n=label(x.tags);if(n==="Ciekawe miejsce"&&!x.tags.name)return;if(seen[n])return;seen[n]=1;out.push({name:n,d:d,lat:x.lat,lon:x.lon,named:!!x.tags.name})});
  out.sort(function(a,b){return(b.named-a.named)||(a.d-b.d)});return out.slice(0,4)}
function findNearby(t){
  var got=nearbyFrom(t,LASTLIST);
  if(got.length>=2)return Promise.resolve(got);
  return sleep(1100).then(function(){return nominatimPOI({lat:t.lat,lon:t.lon},700,"poi")}).then(function(l2){
    var all=nearbyFrom(t,l2),names={};got.concat(all).forEach(function(x){names[x.name]=names[x.name]||x});
    return Object.keys(names).map(function(k){return names[k]}).sort(function(a,b){return(b.named-a.named)||(a.d-b.d)}).slice(0,4)}).catch(function(){return got});
}
function findTarget(I){
  var e=I.e,dist=kmI(I)*1000,kind=MAPKIND[e.mapa],st0;
  return getStart().then(function(st){st0=st;
    return overpass(poiQuery(kind,st.lat,st.lon,dist*1.7)).then(function(els){
      return els.map(function(el){var la=el.lat!=null?el.lat:el.center&&el.center.lat,lo=el.lon!=null?el.lon:el.center&&el.center.lon;return la==null?null:{lat:la,lon:lo,tags:el.tags||{}}}).filter(Boolean)
    }).catch(function(err){if(!err.all)throw err;return kind==="place"?[]:nominatimPOI(st,dist,kind)});
  }).then(function(list){var st=st0;LASTLIST=list;
    var c=list.map(function(x){x.d=hav(st.lat,st.lon,x.lat,x.lon);x.sec=sector(brg(st.lat,st.lon,x.lat,x.lon));return x})
      .filter(function(x){return x.d>250&&!nearUsed(x.lat,x.lon,300)});
    if(kind==="bus"){var near=list.some(function(x){return hav(st.lat,st.lon,x.lat,x.lon)<1500});if(list.length&&!near){var er=new Error("nostop");er.nostop=true;throw er}}
    var ring=c.filter(function(x){return x.d>dist*.65&&x.d<dist*1.35});
    if(!ring.length)ring=c.filter(function(x){return x.d>dist*.4&&x.d<dist*1.7});
    if(kind!=="place"){var named=ring.filter(function(x){return x.tags.name});if(named.length>=(kind==="bus"?1:3))ring=named}
    if(ring.length){var s=chooseSector(ring),inS=ring.filter(function(x){return x.sec===s});var t=inS[Math.floor(Math.random()*inS.length)];
      return{lat:t.lat,lon:t.lon,name:label(t.tags),d:t.d,sec:t.sec,start:{lat:st.lat,lon:st.lon}}}
    if(kind==="poi"&&list.length)return roadPoint(st,dist);
    return fallbackTarget(st,dist,kind);
  }).then(addLocality).then(function(t){D.g.sec[t.sec]=D.g.ctr=(D.g.ctr||0)+1;save();return t});
}
function roadPoint(st,dist){
  var s=chooseSector([0,1,2,3,4,5,6,7].map(function(i){return{sec:i}}));var b=s*45+(Math.random()*40-20);
  var p=dest(st.lat,st.lon,dist,b);
  var q="[out:json][timeout:25];way(around:600,"+p.lat.toFixed(5)+","+p.lon.toFixed(5)+")[highway~\"^(track|path|footway|residential|unclassified|service|tertiary|living_street|cycleway|secondary)$\"];node(w);out 400;";
  return overpass(q).catch(function(err){if(err.all)return fallbackTarget(st,dist,"poi").then(function(t){return{fb:t}});throw err}).then(function(els){
    if(els&&els.fb)return els.fb;
    var best=null,bd=Infinity;els.forEach(function(n){if(n.lat==null)return;if(nearUsed(n.lat,n.lon,300))return;var d=hav(p.lat,p.lon,n.lat,n.lon);if(d<bd){bd=d;best=n}});
    if(!best)return fallbackTarget(st,dist,"poi");
    var d=hav(st.lat,st.lon,best.lat,best.lon);
    return{lat:best.lat,lon:best.lon,name:"Punkt na drodze. Sprawdź, co tam jest",d:d,sec:sector(brg(st.lat,st.lon,best.lat,best.lon)),start:{lat:st.lat,lon:st.lon},road:true};
  });
}
function addLocality(t){
  if(t.loc||t.src==="nominatim")return t;
  return sleep(1100).then(function(){return nominatim(t.lat,t.lon,14)}).then(function(j){var a=j.address||{};var loc=a.village||a.town||a.city||a.hamlet||a.suburb||a.municipality||"";
    if(loc&&a.city&&a.suburb&&loc===a.city&&a.suburb!==a.city)loc=a.suburb+", "+a.city;
    if(loc&&t.name.toLowerCase().indexOf(loc.toLowerCase())<0)t.loc=loc;else if(loc)t.loc="";return t}).catch(function(){return t});
}
function mapPreview(t){var s=t.start||t,la1=Math.min(s.lat,t.lat),la2=Math.max(s.lat,t.lat),lo1=Math.min(s.lon,t.lon),lo2=Math.max(s.lon,t.lon);
  var ml=Math.max((la2-la1)*.25,.004),mo=Math.max((lo2-lo1)*.25,.006);
  var bb=[(lo1-mo).toFixed(5),(la1-ml).toFixed(5),(lo2+mo).toFixed(5),(la2+ml).toFixed(5)].join(",");
  return '<iframe class="mapframe" loading="lazy" title="Mapa celu" src="https://www.openstreetmap.org/export/embed.html?bbox='+bb+'&layer=mapnik&marker='+t.lat.toFixed(5)+','+t.lon.toFixed(5)+'"></iframe><p class="small">Pinezka to cel. Mapa obejmuje też twój punkt startu.</p>'}
function pinUrl(t){return "https://www.google.com/maps/search/?api=1&query="+t.lat.toFixed(6)+","+t.lon.toFixed(6)}
function mapTime(e,i,I){var k=I?kmI(I):km(e,i),m;
  if(e.mapa==="pieszo"||e.mapa==="pieszo-daleko")m=k*2*12;else if(e.mapa==="rower")m=k*2*4;else if(e.mapa==="bus")m=k*2*3+30;else return "wyprawa na kilka godzin";
  m=Math.round(m/5)*5;return "ok. "+k+" km · "+(m<60?m+" min":(Math.floor(m/60)+" h"+(m%60?" "+m%60+" min":"")))+" w obie strony"}
function walkInstead(I){
  var e=byId("ok-002"),c=comfort(),best=null,bd=Infinity;
  variants(e).forEach(function(v){var d=Math.abs(effI(e,v.i,c)-I.eff);if(d<bd){bd=d;best=v}});
  var cd=D.g.day.cands[S.mix];cd.mid="ok-002";cd.v=best.v;save();render();
  toast("W pobliżu nie ma przystanku, więc misja zmieniła się na pieszą 🥾");
}
function navUrl(t,e){return "https://www.google.com/maps/dir/?api=1&destination="+t.lat.toFixed(6)+","+t.lon.toFixed(6)+"&travelmode="+(TRAVEL[e.mapa]||"walking")}

/* ---------- aktywne misje ---------- */
function actOf(I){var k=D.g.day.key+"|"+I.key;return D.g.act[k]||(D.g.act[k]={photos:[],note:"",timer:null,gps:false,target:null})}
function cleanAct(){var k=D.g.day&&D.g.day.key;for(var a in D.g.act)if(a.indexOf(k+"|")!==0)delete D.g.act[a]}
function proofOk(I,A){
  return(I.e.dowod||[]).every(function(d){
    if(d==="zdjecie"||d==="zrzut")return A.photos.length>0;
    if(d==="notatka")return(A.note||"").trim().length>=3;
    if(d==="stoper")return A.timer&&(A.timer.skip||(Date.now()-A.timer.start)>=czasI(I)*60000);
    if(d==="gps")return !!A.gps;
    return true});
}
function isDone(I){return D.g.day.done.indexOf(I.key)>=0}

/* ---------- UI: wspólne ---------- */
function nav(){var t=S.step;function b(id,em,n){return '<button class="'+(t===id?"on":"")+'" data-a="tab" data-v="'+id+'"><span>'+em+'</span>'+n+'</button>'}
  return '<nav class="nav">'+b("today","🧭","Dziś")+b("journal","📔","Dziennik")+b("char","🪪","Postać")+'</nav>'}
function lvlBadge(c,pref){return '<span class="lvl '+c+'">'+(pref||"")+LV[c].n+'</span>'}
function missionText(I){var t=instText(I.e,I.v,I.hero);if(I.e.mapa){var A=actOf(I);t=t.replace("{cel}",A.target?"<b>"+esc(A.target.name)+"</b>":"<i>miejsce wskaże mapa</i>")}return t}
function reason(I){var c=comfort(),parts=[];for(var k in I.e.w)parts.push(AREA[k].n+" "+Math.round(I.e.w[k]*100)+"% (twoja strefa "+String(c[k]).replace(".",",")+")");
  var g=(D.goals||[]).indexOf(I.e.kat)>=0;return '<div class="why">🔍 '+(g?"pasuje do twojego celu · ":"")+parts.join(", ")+" · intensywność "+I.i+" → trudność "+(Math.round(I.eff*10)/10).toString().replace(".",",")+(I.v!=="b"?" · wersja "+(I.v==="l"?"łatwiejsza":"trudniejsza"):"")+(I.e.mapa?" · cel ok. "+kmI(I)+" km":"")+'</div>'}

/* ---------- ekran: tryb tygodnia ---------- */
R.weekpick=function(){
  var first=!D.g.week,sum="";
  if(!first){var ws=D.g.week.start,xp=0,n=0;D.g.log.forEach(function(l){if(l.day>=ws&&l.day<mondayKey()){xp+=l.xp;n++}});
    sum='<div class="note">📊 Poprzedni tydzień: <b>'+n+'</b> '+(n===1?"misja":n>1&&n<5?"misje":"misji")+', <b>'+xp+' XP</b>, tryb '+LV[D.g.week.mode].mode.toLowerCase()+'.</div>'}
  var opts=[["E","🌱","Łatwy","Lżejszy tydzień, ale nie odpuszczam. Punkty ×0,8"],["N","🧭","Normalny","Codzienne wyzwania w sam raz. Punkty ×1"],["H","🔥","Trudny","Wyraźnie poza strefą komfortu. Punkty ×1,25"]];
  return '<div class="page"><h2>'+(first?"Jak ostry ma być pierwszy tydzień?":"Nowy tydzień, nowy tryb")+'</h2>'+sum+
  '<p class="lead">W trakcie tygodnia tryb można tylko obniżyć, nigdy podwyższyć.</p><div class="opts">'+
  opts.map(function(o){return '<button class="opt" data-a="setweek" data-v="'+o[0]+'"><span class="em">'+o[1]+'</span><span><b>'+o[2]+'</b><span class="s">'+o[3]+'</span></span></button>'}).join("")+
  '</div><p class="small" style="margin-top:12px">⚔️ Hero nie jest trybem tygodnia: codziennie możesz podbić swoją misję do Hero.</p>'+(D.g.tester?'<p class="small">🧪 W trybie testera i tak zobaczysz misje z kilku poziomów. Tryb tygodnia liczy się po wyłączeniu testera.</p>':'')+'</div>';
};

/* ---------- ekran: Dziś ---------- */
R.today=function(){
  if(!BASE)return '<div class="page"><h2>Ładuję misje…</h2><p class="lead">Potrzebny jest internet przy pierwszym uruchomieniu.</p></div>'+nav();
  if(needWeek()){setTimeout(function(){go("weekpick",false)});return ""}
  ensureDay();cleanAct();
  var d=now(),lvl=totalLevel(D.g.xp),m=D.g.week.mode;
  var h='<div class="dayhead"><div><div class="small">'+DNI[d.getDay()]+', '+fmtDate(d)+(D.g.offset?' <span class="tag">🧪 +'+D.g.offset+' dni</span>':'')+'</div><h2 style="margin:2px 0">Misja dnia</h2></div>'+
    '<div class="xpbox"><b>'+D.g.xp+'</b> XP<br><span>poziom '+lvl+' · 🔥 '+D.g.streak+'</span></div></div>';
  h+='<div class="modebar">Tryb tygodnia: <b>'+LV[m].mode+'</b>'+(m!=="E"?' <button class="mini" data-a="lowermenu">obniż ▾</button>':'')+'</div>';
  if(S.lowerOpen){h+='<div class="chips" style="margin:-4px 0 12px">'+LVORD.slice(0,LVORD.indexOf(m)).map(function(c){return '<button class="chip" data-a="lower" data-v="'+c+'">'+LV[c].mode+'</button>'}).join("")+'</div><p class="small">Po obniżeniu nie da się wrócić wyżej do poniedziałku. Zdobyte punkty zostają.</p>'}
  if(D.g.tester)h+='<div class="tester">🧪 <b>Tryb testera:</b> po jednej misji z każdego poziomu. Wybierz dowolną.</div>';
  D.g.day.cands.forEach(function(cd,ix){
    if(!cd.mid){h+='<div class="mcard empty">'+lvlBadge(cd.want)+' <span class="small">Brak misji na tym poziomie dla twojego profilu.</span></div>';return}
    var I=inst(cd.mid,cd.v);if(!I)return;var done=isDone(I);
    h+='<div class="mcard '+I.lvl+(done?" done":"")+'" data-a="open" data-v="'+ix+'">'+
      '<div class="mtop"><span class="kat">'+KAT[I.e.kat]+'</span>'+(D.g.tester&&cd.want!==I.lvl?lvlBadge(I.lvl):lvlBadge(I.lvl))+'</div>'+
      (I.hero?'<div class="herotag">⚔️ HERO · punkty ×2</div>':'')+
      '<div class="mt">'+missionText(I)+'</div>'+
      '<div class="meta">⏱️ '+(I.e.mapa?mapTime(I.e,I.i,I):czasI(I)+" min")+' · '+I.e.dowod.map(function(x){return DOWOD[x]}).join(", ")+'</div>'+
      (done?'<div class="donebadge">✓ Zaliczona</div>':'')+
      (D.g.tester?'<div class="rowbtn"><button class="mini" data-a="reroll" data-v="'+ix+'">🎲 Losuj inną</button></div>':'')+'</div>';
  });
  if(!D.g.tester){var c0=D.g.day.cands[0];var I0=c0&&c0.mid&&inst(c0.mid,c0.v);
    if(I0&&!isDone(I0))h+=D.g.day.swaps<1?'<button class="btn ghost" data-a="swap">🔄 Wymień misję (1 dziennie)</button>':'<p class="small center">Dzisiejsza wymiana już wykorzystana.</p>';
    if(I0&&isDone(I0))h+='<p class="center">Na dziś wszystko. Wracaj jutro po nową misję! 🌙</p>'}
  h+='<div class="links">'+(D.g.tester?'<button class="btn link" data-a="go" data-v="browse">📚 Podgląd całej bazy misji</button>':'')+
    '<button class="btn link" data-a="go" data-v="suggest">💡 Zaproponuj misję</button></div>';
  return h+nav();
};

/* ---------- ekran: misja ---------- */
function curInst(){var cd=D.g.day.cands[S.mix];return cd&&cd.mid?inst(cd.mid,cd.v):null}
R.mission=function(){
  var I=curInst();if(!I){setTimeout(function(){go("today",false)});return ""}
  var A=actOf(I),e=I.e,done=isDone(I),avg={S:5,B:5,M:5,C:5,A:5},o=lvlOf(effI(e,I.i,avg));
  var h=head()+'<div class="page"><span class="kat">'+KAT[e.kat]+'</span>'+
    '<div class="mt" style="font-size:23px;margin:8px 0 10px">'+missionText(I)+'</div>'+
    lvlBadge(I.lvl,"Dla ciebie: ")+(o!==I.lvl?' <span class="small">(dla przeciętnej osoby: '+LV[o].n.toLowerCase()+')</span>':'')+
    (D.g.tester?reason(I):'')+
    (e.podpowiedz?'<details class="hint"><summary>💡 Jak to zrobić? Podpowiedzi</summary><ul>'+e.podpowiedz.map(function(x){return '<li>'+gtxt(x)+'</li>'}).join("")+'</ul></details>':'')+
    (I.hero?'<div class="herotag">⚔️ HERO · punkty ×2 · bez cofania</div>':'')+
    '<p class="small">⏱️ '+(e.mapa?mapTime(e,I.i,I):"ok. "+czasI(I)+" min")+' · Dowód: '+e.dowod.map(function(x){return DOWOD[x]}).join(", ")+'</p>';
  if(done){var lg=D.g.log.filter(function(l){return l.day===D.g.day.key&&l.key===I.key})[0];
    h+='<div class="note">✓ Misja zaliczona'+(lg?': <b>+'+lg.xp+' XP</b>':'')+'.</div></div>';return h}
  if(!I.hero&&(D.g.tester||!D.g.day.hero)){
    h+='<div class="herobox"><b>⚔️ Podbij do Hero</b><p class="small">'+(e.hero?'Wersja Hero: „'+gtxt(e.hero).replace("{cel}","miejsce dalej niż zwykle")+'”':'Ta sama misja, ale półtora raza dalej.')+'</p><p class="small">Punkty ×2. Raz dziennie, bez cofania. Jeśli nie zdążysz do północy, stracisz 40% punktów, które można było zdobyć.</p>'+
      '<button class="btn ghost" data-a="hero">'+(S.heroArm?'⚔️ Na pewno? Stuknij jeszcze raz':'⚔️ Podbijam do Hero')+'</button></div>';
  }
  if(e.mapa){
    h+='<div class="box"><b>🗺️ Cel</b>';
    if(S.mapBusy)h+='<p>Szukam celu w okolicy… 🧭</p>';
    else if(A.target){var t=A.target;
      if(t.nearby===undefined&&S.nbFor!==t){S.nbFor=t;findNearby(t).then(function(n){t.nearby=n;save();if(S.step==="mission")render()})}
      h+='<p class="big">'+esc(t.name)+'</p>'+(t.loc?'<p>📍 <b>'+esc(t.loc)+'</b></p>':'')+'<p class="small">'+fmtKm(t.d)+' '+DIRS[t.sec]+' od punktu startu</p>'+
      mapPreview(t)+
      '<details class="nearby"'+(S.nbOpen?' open':'')+' ontoggle="S.nbOpen=this.open"><summary>👀 Co jeszcze warto zobaczyć w okolicy? <span class="small">(opcjonalnie'+(t.nearby&&t.nearby.length?', '+t.nearby.length:'')+')</span></summary>'+(t.nearby==null?'<p class="small">Szukam ciekawych miejsc w okolicy celu…</p>':
        t.nearby.length?'<p class="small">Nie musisz nic z tego zaliczać. To tylko podpowiedź, jeśli masz ochotę się rozejrzeć.</p><ul>'+t.nearby.map(function(n){return '<li><a href="'+pinUrl(n)+'" target="_blank" rel="noopener">'+esc(n.name)+'</a> <span class="small">· '+fmtKm(n.d)+' od celu</span></li>'}).join("")+'</ul>':
        '<p class="small">Na mapie nic tu nie zaznaczono. Może to ty coś odkryjesz? Zrób zdjęcie najciekawszej rzeczy, jaką znajdziesz. 🔎</p>')+'</details>'+
      '<div class="grid2"><a class="btn ghost" style="text-align:center;text-decoration:none" href="'+pinUrl(t)+'" target="_blank" rel="noopener">📌 Pokaż punkt</a><a class="btn ghost" style="text-align:center;text-decoration:none" href="'+navUrl(t,e)+'" target="_blank" rel="noopener">🧭 Nawiguj</a></div>'+
      ((D.g.tester||(A.knownN||0)<2)?'<button class="btn ghost" data-a="known">🙅 Znam to miejsce, daj inne'+(D.g.tester?'':' ('+(2-(A.knownN||0))+')')+'</button>':'<p class="small">Wykorzystano obie wymiany celu. Idź śmiało, może cię zaskoczy! 🧭</p>')}
    else h+='<p class="small">Aplikacja wybierze miejsce, w którym jeszcze nie byłeś/aś, za każdym razem w innym kierunku.</p>'.replace("byłeś/aś",G("byłeś","byłaś"))+'<button class="btn ghost" data-a="target">📍 Wyznacz cel</button>'+
      (D.g.home?'<p class="small">Start: '+(D.g.useHome?"twój zapisany punkt":"bieżąca lokalizacja")+'</p>':'');
    if(S.mapErr)h+='<div class="err">'+esc(S.mapErr)+'</div>';
    if(D.g.tester&&MAPDIAG.length)h+='<details class="small"><summary>🧪 Diagnostyka map</summary>'+MAPDIAG.map(function(x){return '<div>'+esc(x)+'</div>'}).join("")+'<button class="btn link" data-a="sharediag">📤 Wyślij diagnostykę</button></details>';
    h+='</div>';
  }
  e.dowod.forEach(function(d){
    h+='<div class="box">';
    if(d==="zdjecie"||d==="zrzut"){h+='<b>'+DOWOD[d]+'</b><div class="thumbs">'+A.photos.map(function(pk){return '<img data-pk="'+pk+'" alt="">'}).join("")+'</div>'+
      '<button class="btn ghost" data-a="photo" data-v="'+(d==="zdjecie"?"cam":"gal")+'">'+(d==="zdjecie"?"📷 Zrób zdjęcie":"🖼️ Dodaj zrzut ekranu")+'</button>'+
      (d==="zdjecie"?'<button class="btn link" data-a="photo" data-v="gal">albo wybierz z galerii</button>':'')}
    if(d==="notatka")h+='<b>✍️ Notatka</b><textarea rows="3" placeholder="Jak poszło? Co się wydarzyło?" data-in="note">'+esc(A.note)+'</textarea>';
    if(d==="stoper"){var need=czasI(I)*60000;
      if(!A.timer)h+='<b>⏱️ Stoper: '+czasI(I)+' min</b><button class="btn ghost" data-a="timer">▶ Start</button>';
      else{var left=Math.max(0,need-(Date.now()-A.timer.start));h+='<b>⏱️ Stoper</b><div class="timer" id="tmr">'+(A.timer.skip||!left?"✓ Gotowe":mmss(left))+'</div>'+
        (D.g.tester&&left&&!A.timer.skip?'<button class="btn link" data-a="tskip">⏩ Pomiń czekanie (tester)</button>':'')}}
    if(d==="gps")h+='<b>📍 Na miejscu</b>'+(A.gps?'<p>✓ Jesteś na miejscu!</p>':'<button class="btn ghost" data-a="checkin" '+(A.target?"":"disabled")+'>📍 Jestem na miejscu</button>'+(D.g.tester&&A.target?'<button class="btn link" data-a="gpsskip">⏩ Zalicz bez GPS (tester)</button>':''));
    h+='</div>';
  });
  h+='</div>'+bar("✅ Zaliczam misję",!proofOk(I,A),"go('rate')");
  return h;
};
function mmss(ms){var s=Math.ceil(ms/1000),m=Math.floor(s/60);return(m>=60?Math.floor(m/60)+":"+("0"+m%60).slice(-2):m)+":"+("0"+s%60).slice(-2)}
setInterval(function(){if(S.step!=="mission")return;var el=document.getElementById("tmr");if(!el)return;var I=curInst();if(!I)return;var A=actOf(I);if(!A.timer||A.timer.skip)return;
  var left=Math.max(0,czasI(I)*60000-(Date.now()-A.timer.start));if(!left){render();return}el.textContent=mmss(left)},1000);

/* ---------- ekran: ocena ---------- */
R.rate=function(){
  var I=curInst();if(!I){setTimeout(function(){go("today",false)});return ""}
  return head()+'<div class="page"><h2>Jak było?</h2><p class="lead">'+missionText(I)+'</p><div class="opts">'+
    [["easy","😎","Za łatwe"],["ok","👌","W sam raz"],["hard","😵","Za trudne"]].map(function(o){return '<button class="opt'+(S.rate===o[0]?" on":"")+'" data-a="rate" data-v="'+o[0]+'"><span class="em">'+o[1]+'</span><b>'+o[2]+'</b></button>'}).join("")+
    '</div><span class="lbl">Czy misja ci się podobała?</span><div class="chips">'+
    '<button class="chip'+(S.like==="y"?" on":"")+'" data-a="like" data-v="y">👍 Tak</button><button class="chip'+(S.like==="n"?" on":"")+'" data-a="like" data-v="n">👎 Nie bardzo</button></div>'+
    (actOf(I).note&&!D.shareOff?'<label class="chk"><input type="checkbox" '+(S.sendNote?"checked":"")+' onchange="S.sendNote=this.checked"> Dołącz moją notatkę do wyników testów</label>':'')+
    '</div>'+bar("Zapisz w dzienniku",!S.rate,"finishMission()");
};
function finishMission(){
  var I=curInst(),A=actOf(I),c=comfort();
  var mult=I.hero?2:D.g.tester?LV[I.lvl].mult:LV[D.g.week.mode==="X"?"H":D.g.week.mode].mult;
  var k=dkey();
  if(D.g.lastDone!==k){var gap=D.g.lastDone?daysBetween(D.g.lastDone,k):99;D.g.streak=gap===1?D.g.streak+1:1;D.g.lastDone=k}
  var sb=1+Math.min(.3,.02*Math.max(0,D.g.streak-1));
  var xp=Math.round(10*Math.min(I.eff,3*I.i)*mult*sb);
  D.g.xp+=xp;
  // kalibracja stref komfortu
  if(S.rate!=="ok"){var sg=S.rate==="easy"?1:-1;if(!D.comfort)D.comfort=c;
    for(var a in I.e.w){D.comfort[a]=r1(clamp(D.comfort[a]+sg*.3*I.e.w[a],0,10));if(D.pending)D.pending.c[a]=r1(clamp(D.pending.c[a]+sg*.3*I.e.w[a],0,10))}}
  D.started=true;
  if(A.target&&A.gps)D.g.visited.push({lat:A.target.lat,lon:A.target.lon});
  D.g.log.unshift({day:D.g.day.key,mid:I.mid,v:I.v,key:I.key,text:missionText(I).replace(/<[^>]+>/g,""),kat:I.e.kat,lvl:I.hero?"X":I.lvl,xp:xp,rate:S.rate,like:S.like||null,note:A.note||"",photos:A.photos.slice(),place:A.target?A.target.name:null,tester:D.g.tester});
  D.g.day.done.push(I.key);
  report(D.g.tester?"misja-test":"misja",{misja:I.mid+(I.v!=="b"?"/"+I.v:""),poziom:LV[I.lvl].n+(I.hero?" + Hero":""),ocena:S.rate,d:{like:S.like||null,xp:xp,trudnosc:r1(I.eff),tryb:D.g.week.mode,hero:I.hero,kat:I.e.kat,dzien:D.g.day.key,seria:D.g.streak,cel:A.target?A.target.name:null,notatka:S.sendNote&&A.note?A.note:null,strefy:D.comfort,wersja:APP_VER}});
  S.rate=null;S.like=null;S.sendNote=false;save();S.hist=[];go("today",false);
  toast("+"+xp+" XP 🎉"+(D.g.streak>1?"  Seria: "+D.g.streak+" dni":""));
}

/* ---------- ekran: dziennik ---------- */
R.journal=function(){
  var lv=totalLevel(D.g.xp),f=lvlFloor(lv),n=lvlFloor(lv+1),p=Math.round((D.g.xp-f)/(n-f)*100);
  var h='<h2>Dziennik podróżnika</h2><div class="stats"><div><b>'+lv+'</b><span>poziom</span></div><div><b>'+D.g.xp+'</b><span>XP</span></div><div><b>'+D.g.streak+'</b><span>🔥 seria</span></div><div><b>'+D.g.log.length+'</b><span>misji</span></div></div>'+
    '<div class="mtr"><div class="lab"><span>Poziom '+lv+'</span><span>'+(n-D.g.xp)+' XP do poziomu '+(lv+1)+'</span></div><div class="track"><i style="left:'+p+'%"></i></div></div>';
  if(!D.g.log.length)h+='<div class="page center" style="margin-top:18px"><p class="lead">Tu pojawią się pieczątki z wykonanych misji. 🧭</p></div>';
  var last="";
  D.g.log.forEach(function(l){
    if(l.day!==last){last=l.day;var dd=new Date(l.day+"T12:00:00");h+='<div class="jday">'+DNI[dd.getDay()]+', '+fmtDate(dd)+'</div>'}
    h+='<div class="jentry"><div class="jstamp '+l.lvl+'">'+LV[l.lvl].n+'<br><b>'+(l.xp<0?"":"+")+l.xp+'</b></div><div class="jbody"><div class="small">'+KAT[l.kat]+'</div><div class="mt" style="font-size:17px">'+esc(l.text)+'</div>'+
      (l.place?'<div class="small">📍 '+esc(l.place)+'</div>':'')+(l.note?'<div class="jnote">„'+esc(l.note)+'”</div>':'')+
      '<div class="thumbs">'+(l.photos||[]).map(function(pk){return '<img data-pk="'+pk+'" alt="">'}).join("")+'</div>'+
      '<div class="small">'+(l.kara?"⚔️ kara za niewykonaną misję Hero":({easy:"😎 za łatwe",ok:"👌 w sam raz",hard:"😵 za trudne"}[l.rate]||""))+(l.like==="y"?" · 👍":l.like==="n"?" · 👎":"")+'</div></div></div>';
  });
  var rl=D.g.log.filter(function(l){return !l.kara});if(rl.length){var ok=rl.filter(function(l){return l.rate==="ok"}).length;h+='<p class="small center">W sam raz: '+Math.round(ok/rl.length*100)+'% misji (cel testów: ponad 70%)</p><button class="btn ghost" data-a="sharelog">📤 Wyślij podsumowanie testów</button>'}
  return h+nav();
};

/* ---------- ekran: postać + ustawienia ---------- */
R.char=function(){
  var h=R.card();
  h+='<hr class="sep"><div class="sec"><h3>Ustawienia</h3>'+
  '<button class="opt'+(!D.shareOff?" on":"")+'" data-a="share"><span class="em">📤</span><span><b>Wysyłaj wyniki testów '+(!D.shareOff?"✓":"")+'</b><span class="s">Misja, poziom, ocena i punkty trafiają do arkusza Maćka. Bez zdjęć i lokalizacji.</span></span></button>'+
  '<span class="lbl">📅 Codzienne przypomnienie</span>'+calButtons()+
  ((D.g.tester||D.g.dev)?'<button class="opt'+(D.g.tester?" on":"")+'" data-a="tester"><span class="em">🧪</span><span><b>Tryb testera '+(D.g.tester?"✓":"")+'</b><span class="s">Misje z kilku poziomów naraz, podgląd bazy, przeskakiwanie dni</span></span></button>':'')+
  (D.g.tester?'<div class="grid2" style="margin-top:10px"><button class="btn ghost" data-a="skip" data-v="1">⏭️ Przeskocz dzień</button><button class="btn ghost" data-a="skip" data-v="7">⏩ Przeskocz tydzień</button></div>'+
    (D.g.offset?'<button class="btn link" data-a="skip" data-v="0">↩ Wróć do prawdziwej daty (teraz +'+D.g.offset+' dni)</button>':''):'')+
  '<span class="lbl">🚌 Autobus albo pociąg w pobliżu</span><div class="chips"><button class="chip'+(hasTransit()?" on":"")+'" data-a="transit" data-v="yes">Tak, jeździ</button><button class="chip'+(!hasTransit()?" on":"")+'" data-a="transit" data-v="no">Nie ma albo bardzo rzadko</button></div>'+
  '<span class="lbl">📍 Punkt startowy misji z mapą</span><div class="chips"><button class="chip'+(!D.g.useHome?" on":"")+'" data-a="usehome" data-v="0">Bieżąca lokalizacja</button><button class="chip'+(D.g.useHome?" on":"")+'" data-a="usehome" data-v="1">Mój zapisany punkt</button></div>'+
  '<button class="btn link" data-a="sethome">'+(D.g.home?"📌 Zapisz obecne miejsce jako nowy punkt (jest zapisany)":"📌 Zapisz obecne miejsce jako mój punkt")+'</button>'+
  '<p class="small">Punkt zostaje tylko w tym telefonie. Bez śledzenia w tle.</p>'+
  '<button class="btn link" data-a="go" data-v="suggest">💡 Zaproponuj misję</button>'+
  '<p class="small" data-a="ver">Wersja aplikacji: <b>'+APP_VER+'</b>'+((D.outbox&&D.outbox.length)?' · do wysłania: '+D.outbox.length:'')+'</p>'+
  '<button class="btn link" style="color:var(--red)" onclick="resetAll()">'+(S.resetArmed?"Na pewno? Usunie postać, punkty i dziennik. Stuknij jeszcze raz":"Zacznij od nowa")+'</button></div>';
  return h+nav();
};

/* ---------- ekran: podgląd bazy ---------- */
R.browse=function(){
  var c=comfort(),f=S.bf||"all",rows=[];
  (BASE||[]).forEach(function(e){if(f!=="all"&&e.kat!==f)return;var x=effI(e,e.i,c);rows.push({e:e,x:x,ok:allowed(e)})});
  rows.sort(function(a,b){return a.x-b.x});
  var R2={d:"dzienna",t:"tygodniowa",m:"miesięczna"};
  return head()+'<h2>Baza misji</h2><p class="small">Wszystkie misje od najłatwiejszej do najtrudniejszej dla twojego profilu. Wyszarzone nie pasują do twoich ograniczeń.</p>'+
  '<div class="cats"><button class="chip'+(f==="all"?" on":"")+'" data-a="bf" data-v="all">Wszystkie</button>'+Object.keys(KAT).map(function(k){return '<button class="chip'+(f===k?" on":"")+'" data-a="bf" data-v="'+k+'">'+KAT[k]+'</button>'}).join("")+'</div>'+
  rows.map(function(r){var l=lvlOf(r.x);return '<div class="brow'+(r.ok?"":" off")+'"><div>'+lvlBadge(l)+' <span class="small">'+(Math.round(r.x*10)/10).toString().replace(".",",")+' · '+R2[r.e.rytm]+' · '+r.e.id+'</span></div><div>'+gtxt(r.e.t).replace("{cel}","[miejsce z mapy]")+'</div></div>'}).join("");
};

/* ---------- ekran: propozycja misji ---------- */
R.suggest=function(){
  var s=S.sug||(S.sug={t:"",kat:"",rytm:"d",tr:""});
  return head()+'<div class="page"><h2>Zaproponuj misję</h2><p class="lead">Masz pomysł? Opisz go, a trafi do bazy dla wszystkich.</p>'+
  '<textarea rows="4" data-in="sugt" placeholder="np. Zrób zdjęcie najstarszego budynku w swojej okolicy">'+esc(s.t)+'</textarea>'+
  '<span class="lbl">Kategoria</span><div class="chips">'+Object.keys(KAT).map(function(k){return '<button class="chip'+(s.kat===k?" on":"")+'" data-a="sug" data-v="kat:'+k+'">'+KAT[k]+'</button>'}).join("")+'</div>'+
  '<span class="lbl">Jak często</span><div class="chips">'+[["d","Dzienna"],["t","Tygodniowa"],["m","Miesięczna"]].map(function(o){return '<button class="chip'+(s.rytm===o[0]?" on":"")+'" data-a="sug" data-v="rytm:'+o[0]+'">'+o[1]+'</button>'}).join("")+'</div>'+
  '<span class="lbl">Dla przeciętnej osoby to misja…</span><div class="chips">'+LVORD.map(function(c){return '<button class="chip'+(s.tr===c?" on":"")+'" data-a="sug" data-v="tr:'+c+'">'+LV[c].n+'</button>'}).join("")+'</div>'+
  '</div>'+bar("📤 Wyślij propozycję",false,"sendSuggest()");
};
function sendSuggest(){var s=S.sug;if(!s.t.trim()){toast("Opisz najpierw misję");return}
  var t="💡 Propozycja misji do Misji Dnia od "+(D.nick||"")+":\n„"+s.t.trim()+"”\nKategoria: "+(KAT[s.kat]||"—")+"\nRytm: "+({d:"dzienna",t:"tygodniowa",m:"miesięczna"}[s.rytm])+"\nTrudność: "+(s.tr?LV[s.tr].n:"—");
  shareText(t,function(){S.sug=null;S.hist=[];go(D.g?"today":"card",false);toast("Dzięki za pomysł! 🙌")});
}
function shareText(t,done){
  if(navigator.share)navigator.share({text:t}).then(done).catch(function(){});
  else if(navigator.clipboard)navigator.clipboard.writeText(t).then(function(){toast("Skopiowano. Wklej w wiadomości");done&&done()});
  else toast("Nie mogę udostępnić na tym urządzeniu");
}

/* ---------- wyniki testów (Formularz Google) ---------- */
var FORM="https://docs.google.com/forms/d/e/1FAIpQLSd57zdbphj_VhymScKnuXQdKfkNtu0SBN_w1sfgOHQBaNM0xA/formResponse";
var FE={typ:"444640920",nick:"1810944420",misja:"1399195604",poziom:"1083940506",ocena:"558542356",szcz:"763153339"};
function report(typ,o){if(D.shareOff)return;D.uid=D.uid||Math.random().toString(36).slice(2,6);
  var row={typ:typ,nick:(D.nick||"?")+"#"+D.uid,misja:o.misja||"",poziom:o.poziom||"",ocena:o.ocena||"",szcz:JSON.stringify(o.d||{})};
  D.outbox=(D.outbox||[]).concat([row]).slice(-200);save();flushOut()}
var _flushing=false;
function flushOut(){if(_flushing||!D.outbox||!D.outbox.length||navigator.onLine===false)return;_flushing=true;var row=D.outbox[0],b=new URLSearchParams();
  for(var k in FE)b.append("entry."+FE[k],row[k]);
  fetch(FORM,{method:"POST",mode:"no-cors",body:b}).then(function(){_flushing=false;D.outbox.shift();save();if(D.outbox.length)setTimeout(flushOut,700)}).catch(function(){_flushing=false})}
window.addEventListener("online",flushOut);
function sendProfile(){var c=comfort(),cl=charClass(),ax=axisVals();D.profSent=true;
  report("profil",{misja:"",poziom:cl.name,ocena:D.rating?D.rating+"/5":"",d:{sciezka:D.knowType==="yes"?(D.path==="quick"?"szybki start":"typ + scenki"):"pytania + scenki",typ:D.type&&D.knowType==="yes"?D.type.EI+D.type.SN+D.type.TF+D.type.JP+(D.type.AT?"-"+D.type.AT:""):null,
    strefy:c,introwersja:Math.round(ax.intro),spontan:Math.round(ax.spontan),nowosc:Math.round(ax.nowosc),cele:D.goals,wiek:D.age,miejsce:D.place,czas:D.time,pora:D.when,komunikacja:hasTransit(),uwagi:D.comment||null,forma:D.form,wersja:APP_VER}})}
/* ---------- przypomnienie w kalendarzu ---------- */
function calDates(){var h=+((D.perm&&D.perm.hour)||8),d=new Date();d.setDate(d.getDate()+1);function p(n){return("0"+n).slice(-2)}
  var day=d.getFullYear()+p(d.getMonth()+1)+p(d.getDate());return{s:day+"T"+p(h)+"0000",e:day+"T"+p(h)+"1000"}}
function calButtons(){var c=calDates(),txt="🧭 Misja Dnia",det="Czas na dzisiejszą misję! https://geezotto-pl.github.io/misja-dnia/";
  var g="https://calendar.google.com/calendar/render?action=TEMPLATE&text="+encodeURIComponent(txt)+"&details="+encodeURIComponent(det)+"&dates="+c.s+"/"+c.e+"&ctz=Europe/Warsaw&recur="+encodeURIComponent("RRULE:FREQ=DAILY");
  return '<div class="grid2"><a class="btn ghost" style="text-align:center;text-decoration:none" href="'+g+'" target="_blank" rel="noopener">📅 Kalendarz Google</a><button class="btn ghost" data-a="ics">🍏 Inny kalendarz / iPhone</button></div><p class="small">Codzienne wydarzenie o '+((D.perm&&D.perm.hour)||8)+':00. Godzinę zmienisz potem w kalendarzu.</p>'}
function icsFile(){var c=calDates(),s=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Misja Dnia//PL","BEGIN:VEVENT","UID:misja-dnia-"+(D.uid||"x")+"@geezotto-pl.github.io","DTSTAMP:"+new Date().toISOString().replace(/[-:]/g,"").slice(0,15)+"Z",
  "DTSTART;TZID=Europe/Warsaw:"+c.s,"DTEND;TZID=Europe/Warsaw:"+c.e,"RRULE:FREQ=DAILY","SUMMARY:🧭 Misja Dnia","DESCRIPTION:Czas na dzisiejszą misję! https://geezotto-pl.github.io/misja-dnia/","BEGIN:VALARM","TRIGGER:PT0M","ACTION:DISPLAY","DESCRIPTION:Misja Dnia","END:VALARM","END:VEVENT","END:VCALENDAR"].join("\r\n");
  var a=document.createElement("a");a.href=URL.createObjectURL(new Blob([s],{type:"text/calendar"}));a.download="misja-dnia.ics";document.body.appendChild(a);a.click();setTimeout(function(){a.remove()},1000)}
/* ---------- wprowadzenie ---------- */
var INTRO=[
 ["🧭","Codziennie jedna misja","Każdego dnia dostajesz jedną misję dobraną do ciebie: trochę poza strefą komfortu, ale wykonalną. Raz dziennie możesz ją wymienić, ale spróbuj zdać się na to, co wylosowało."],
 ["📷","Zrób i udokumentuj","Dowodem jest zdjęcie, krótka notatka, stoper albo GPS na miejscu. Przy misjach z mapą aplikacja sama wskazuje cel, za każdym razem w innym kierunku."],
 ["👌","Oceń, a aplikacja się nauczy","Po misji powiedz, czy była za łatwa, w sam raz, czy za trudna. Na tej podstawie kolejne misje lepiej do ciebie pasują."],
 ["⚔️","Tryb tygodnia i Hero","W poniedziałek wybierasz tryb tygodnia (w trakcie można go tylko obniżyć). Codziennie możesz też podbić misję do Hero: trudniej, punkty ×2, ale bez cofania, a za niewykonanie tracisz 40% możliwych punktów."],
 ["🧪","Jesteś testerem!","Twoje wyniki (misja, poziom, ocena, punkty) trafiają do arkusza Maćka. Bez zdjęć i bez lokalizacji. Możesz to wyłączyć w Postać → Ustawienia."]];
R.intro=function(){var i=S.introStep||0,x=INTRO[i],last=i===INTRO.length-1;
  var dots='<div class="dots">'+INTRO.map(function(_,j){return '<i class="'+(j===i?"on":"")+'"></i>'}).join("")+'</div>';
  return '<div class="page center"><div style="font-size:64px;margin:10px 0">'+x[0]+'</div><h2>'+x[1]+'</h2><p class="lead">'+x[2]+'</p>'+
    (last?'<button class="opt'+(!D.shareOff?" on":"")+'" data-a="share" style="margin:8px 0"><span class="em">📤</span><b>Wysyłaj wyniki testów '+(!D.shareOff?"✓":"")+'</b></button><span class="lbl">📅 Przypominajka (polecam!)</span>'+calButtons():'')+dots+'</div>'+
    bar(last?"🚀 Zaczynamy!":"Dalej",false,"ACT.intro('"+(last?"end":i+1)+"')");
};
/* ---------- akcje ---------- */
var ACT={
  tab:function(v){S.hist=[];S.lowerOpen=false;go(v,false)},
  go:function(v){go(v)},
  setweek:function(v){var ms=mondayKey();D.g.week={start:ms,mode:v};if(!D.g.day||!D.g.day.done.length)D.g.day=null;save();report("tydzien",{poziom:LV[v].mode,d:{tydzien:ms}});S.hist=[];go(D.g.introDone?"today":"intro",false)},
  lowermenu:function(){S.lowerOpen=!S.lowerOpen;render()},
  lower:function(v){D.g.week.mode=v;S.lowerOpen=false;if(!D.g.tester){var c=D.g.day.cands[0];var I=c&&c.mid&&inst(c.mid,c.v);if(!I||!isDone(I))D.g.day=null}save();render();toast("Tryb obniżony: "+LV[v].mode)},
  open:function(v){S.mix=+v;S.mapErr=null;go("mission")},
  reroll:function(v){var ix=+v,cd=D.g.day.cands[ix],excl={};D.g.day.cands.forEach(function(x){if(x.mid)excl[x.mid]=1});var p=pickLevel(cd.want,excl);if(p){D.g.day.cands[ix]=p;save();render()}else toast("Brak innych misji na tym poziomie")},
  swap:function(){var cd=D.g.day.cands[0],excl={};excl[cd.mid]=1;var I=inst(cd.mid,cd.v);var p=pickLevel(I?I.lvl:cd.want,excl);if(p){p.want=cd.want;D.g.day.cands[0]=p;D.g.day.swaps++;save();render();toast("Nowa misja 🎲")}else toast("Brak innych misji na tym poziomie")},
  target:function(){var I=curInst(),A=actOf(I);S.mapBusy=true;S.mapErr=null;render();
    findTarget(I).then(function(t){A.target=t;A.gps=false;S.mapBusy=false;save();render();
      findNearby(t).then(function(n){if(A.target===t){t.nearby=n;save();if(S.step==="mission")render()}})}).catch(function(err){S.mapBusy=false;
      if(err.nostop){walkInstead(I);return}
      S.mapErr=err.message||"Nie udało się wyznaczyć celu";render()})},
  known:function(){var I=curInst(),A=actOf(I);
    if(!D.g.tester&&(A.knownN||0)>=2){toast("Limit wymian celu dla tej misji. Spróbuj, może cię zaskoczy!");return}
    A.knownN=(A.knownN||0)+1;if(A.target)D.g.known.push({lat:A.target.lat,lon:A.target.lon});A.target=null;save();ACT.target()},
  checkin:function(){var I=curInst(),A=actOf(I);if(!A.target)return;toast("Sprawdzam lokalizację…");
    getPos().then(function(p){var d=hav(p.lat,p.lon,A.target.lat,A.target.lon);if(d<=75+Math.min(p.acc||0,50)){A.gps=true;save();render();toast("Jesteś na miejscu! 📍")}else toast("Jesteś "+fmtKm(d)+" od celu")}).catch(function(err){toast(err.message)})},
  gpsskip:function(){var A=actOf(curInst());A.gps=true;save();render()},
  timer:function(){var A=actOf(curInst());A.timer={start:Date.now()};save();render()},
  tskip:function(){var A=actOf(curInst());A.timer.skip=true;save();render()},
  photo:function(v){S.photoFor=v;document.getElementById(v==="cam"?"pCam":"pGal").click()},
  rate:function(v){S.rate=v;render()},
  like:function(v){S.like=S.like===v?null:v;render()},
  tester:function(){D.g.tester=!D.g.tester;save();render();toast(D.g.tester?"Tryb testera włączony":"Tryb testera wyłączony")},
  skip:function(v){v=+v;if(v===0)D.g.offset=0;else D.g.offset=(D.g.offset||0)+v;save();S.hist=[];go("today",false);toast(v?"Przeskoczono "+(v===1?"dzień":"tydzień"):"Prawdziwa data")},
  usehome:function(v){if(v==="1"&&!D.g.home){toast("Najpierw zapisz swój punkt");return}D.g.useHome=v==="1";save();render()},
  sethome:function(){toast("Sprawdzam lokalizację…");getPos().then(function(p){D.g.home={lat:p.lat,lon:p.lon};D.g.useHome=true;save();render();toast("Zapisano punkt startowy 📌")}).catch(function(err){toast(err.message)})},
  bf:function(v){S.bf=v;render()},
  hero:function(){if(!S.heroArm){S.heroArm=true;render();setTimeout(function(){S.heroArm=false;if(S.step==="mission")render()},4000);return}
    S.heroArm=false;var I=curInst(),A=actOf(I);A.hero=true;A.target=null;A.timer=null;A.knownN=0;var I2=inst(I.mid,I.v);
    if(!D.g.tester){D.g.day.hero=I.key;D.g.day.heroXP=Math.round(10*Math.min(I2.eff,3*I2.i)*2)}else D.g.day.heroTester=true;
    report("hero",{misja:I.mid,poziom:LV[I.lvl].n+" + Hero",d:{dzien:D.g.day.key}});save();render();toast("⚔️ Misja podbita do Hero!")},
  share:function(){D.shareOff=!D.shareOff;save();render()},
  ver:function(){S.verTaps=(S.verTaps||0)+1;if(S.verTaps>=5){S.verTaps=0;D.g.dev=true;save();render();toast("🧪 Odblokowano tryb testera w ustawieniach")}},
  intro:function(v){if(v==="end"){D.g.introDone=true;save();S.hist=[];go("today",false);return}S.introStep=+v;render();window.scrollTo(0,0)},
  transit:function(v){D.transit=v;if(D.g.day&&!D.g.day.done.length)D.g.day=null;save();render()},
  sug:function(v){var p=v.split(":");S.sug[p[0]]=S.sug[p[0]]===p[1]?"":p[1];render()},
  ics:function(){icsFile()},
  sharediag:function(){shareText("🧪 Misja Dnia: diagnostyka map (wersja "+APP_VER+")\n"+navigator.userAgent+"\n"+MAPDIAG.join("\n"))},
  sharelog:function(){var L=D.g.log,ok=L.filter(function(l){return l.rate==="ok"}).length;
    var t="🧭 Misja Dnia: testy "+(D.nick||"")+"\nMisji: "+L.length+", XP: "+D.g.xp+", w sam raz: "+Math.round(ok/L.length*100)+"%\n"+
      L.slice(0,40).map(function(l){return "• "+l.day+" "+l.mid+" ["+LV[l.lvl].n+"] "+({easy:"za łatwe",ok:"w sam raz",hard:"za trudne"}[l.rate])+(l.like==="y"?" 👍":l.like==="n"?" 👎":"")+(l.note?" – "+l.note:"")}).join("\n");
    shareText(t)}
};
document.addEventListener("click",function(ev){var b=ev.target.closest("[data-a]");if(!b||b.disabled)return;var f=ACT[b.getAttribute("data-a")];if(f){ev.preventDefault&&b.tagName!=="A"&&ev.preventDefault();f(b.getAttribute("data-v"),b)}});
document.addEventListener("input",function(ev){var k=ev.target.getAttribute&&ev.target.getAttribute("data-in");if(!k)return;
  if(k==="note"){var I=curInst();actOf(I).note=ev.target.value;save();var nb=document.getElementById("nextBtn");if(nb)nb.disabled=!proofOk(I,actOf(I))}
  if(k==="sugt"){S.sug.t=ev.target.value}});
function onProof(ev){var f=ev.target.files&&ev.target.files[0];ev.target.value="";if(!f)return;var I=curInst();if(!I)return;var A=actOf(I);
  compress(f,1000).then(function(data){var pk="p"+Date.now();return pput(pk,data).then(function(){A.photos.push(pk);save();render();toast("Dodano zdjęcie 📸")})}).catch(function(){toast("Nie udało się zapisać zdjęcia")})}
(function(){var a=document.createElement("input");a.type="file";a.accept="image/*";a.setAttribute("capture","environment");a.id="pCam";a.className="hidden";
  var b=document.createElement("input");b.type="file";b.accept="image/*";b.id="pGal";b.className="hidden";
  a.addEventListener("change",onProof);b.addEventListener("change",onProof);document.body.appendChild(a);document.body.appendChild(b)})();
window.gameBack=function(){if(S.step==="intro"){if(S.introStep>0){S.introStep--;render()}return true}if(["mission","rate","browse","suggest"].indexOf(S.step)>=0&&!S.hist.length){go(D.g?"today":"card",false);return true}return false};

/* ---------- po każdym renderze ---------- */
var _render=render;
render=function(){_render();if(["today","journal","char"].indexOf(S.step)>=0)document.body.classList.add("withnav");else document.body.classList.remove("withnav");fillPhotos()};

loadBase(function(){boot();if(D.g&&!D.profSent)sendProfile();setTimeout(flushOut,1500)});
