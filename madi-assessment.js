// 검사별 서브필드 정의
// ── 생활연령 계산 (출생일 + 검사일 → "Xy Xm" / "X세 X개월" 형식) ──
function calcLivingAge(birthStr, testDateStr) {
  if (!birthStr) return null;
  var birth = new Date(birthStr);
  var test  = testDateStr ? new Date(testDateStr) : new Date();
  if (isNaN(birth.getTime()) || isNaN(test.getTime())) return null;
  if (test < birth) return null;

  var years  = test.getFullYear() - birth.getFullYear();
  var months = test.getMonth()    - birth.getMonth();
  var days   = test.getDate()     - birth.getDate();
  if (days < 0) { months -= 1; }
  if (months < 0) { years -= 1; months += 12; }
  if (years < 0) return null;

  // 검사 보고서용 표준 표기: "Xy Xm" (예: 7y 3m)
  return years + 'y ' + months + 'm';
}

// ── 아동 + 검사일 → 생활연령 표시 ──
function onAssessChildChange() {
  var childId = String(document.getElementById('assessChild').value || '');
  var el      = document.getElementById('assessAgeDisplay');
  if (!el) return;
  var child   = childId ? childDB.find(function(c) { return c.id === childId; }) : null;
  var dateEl  = document.getElementById('assessDate');
  var testDate = dateEl ? dateEl.value : '';
  // 검사일이 비어있으면 오늘 기준 (input에도 자동 채움 — 다음 자동저장 시 누락 방지)
  if (!testDate) {
    testDate = getTodayKST();
    if (dateEl) dateEl.value = testDate;
  }

  var ageStr = null;
  if (child && child.birth) {
    ageStr = calcLivingAge(child.birth, testDate);
  }

  if (ageStr) {
    el.textContent = ageStr;
    el.style.color = 'var(--mint)';
    el.style.background = '#f0fdf4';
    el.style.borderColor = 'var(--mint)';
    // 검사일 기준 연령을 별도 프로퍼티에 캐시 — child.age 덮어쓰기 금지
    // (child.age 는 DB 저장 "X세 X개월" 형식; calcLivingAge 는 "Xy Xm" 형식 →
    //  parseAgeToMonths 가 둘 다 파싱 가능하지만 DB 원본을 보존하는 게 안전)
    if (child) child._testAge = ageStr;
  } else {
    el.textContent = '생활연령';
    el.style.color = '#94a3b8';
    el.style.background = '#f8fafc';
    el.style.borderColor = 'var(--border)';
  }
}

// ── 원점수 → 등가연령·백분위 AI 자동 계산 ──
// ═══ 표준화 검사 공식 규준 테이블 ═══

// ── PRES 백분위 규준 ──
// 연령 구간 → 획득점수 → [수용%ile, 표현%ile] (null=해당없음)
var PRES_NORMS = {
  '2;0-2;5': {1:[10,4],2:[14,8],3:[19,11],4:[23,16],5:[28,23],6:[34,30],7:[42,35],8:[52,40],9:[58,48],10:[65,56],11:[69,64],12:[72,69],13:[76,74],14:[81,81],15:[86,85],16:[92,90],17:[92,95],18:[94,96],19:[95,96],20:[96,98],21:[96,null],22:[97,null],23:[98,null]},
  '2;6-2;11':{1:[5,null],2:[6,null],3:[7,null],4:[8,null],5:[10,null],6:[13,null],7:[16,null],8:[17,null],9:[18,2],10:[20,6],11:[26,8],12:[30,14],13:[30,22],14:[32,28],15:[38,32],16:[42,40],17:[48,50],18:[58,60],19:[68,68],20:[74,74],21:[76,80],22:[78,84],23:[82,85],24:[84,88],25:[86,91],26:[88,91],27:[89,91],28:[91,93],29:[93,93],30:[93,93],31:[94,94],32:[96,94],34:[null,95],38:[null,96],43:[null,97],48:[null,98]},
  '3;0-3;5': {13:[2,null],14:[2,2],15:[3,3],16:[4,5],17:[6,13],18:[8,20],19:[12,25],20:[16,30],21:[22,33],22:[26,37],23:[32,42],24:[39,47],25:[49,51],26:[56,54],27:[61,58],28:[65,65],29:[70,71],30:[74,75],31:[80,78],32:[86,81],33:[88,86],34:[91,88],35:[91,89],36:[93,91],37:[94,93],38:[94,94],39:[95,96],40:[96,96],41:[96,97],42:[97,97],44:[98,98],45:[99,99]},
  '3;6-3;11':{10:[1,2],13:[2,6],16:[3,9],18:[4,11],19:[6,12],20:[9,14],21:[11,16],22:[14,20],23:[17,24],24:[22,28],25:[28,32],26:[34,34],27:[37,39],28:[40,47],29:[44,57],30:[50,65],31:[56,71],32:[60,76],33:[67,78],34:[73,81],35:[78,84],36:[84,86],37:[86,89],38:[90,92],39:[92,94],40:[94,97],41:[95,99],42:[96,null],43:[98,null],44:[99,null]},
  '4;0-4;5': {16:[2,1],19:[4,2],21:[6,3],22:[8,4],23:[9,5],24:[11,6],25:[14,8],26:[16,10],27:[18,12],28:[22,14],29:[28,16],30:[40,18],31:[44,24],32:[44,30],33:[48,32],34:[52,35],35:[58,40],36:[63,45],37:[68,55],38:[76,62],39:[80,70],40:[84,76],41:[88,80],42:[91,85],43:[93,90],44:[96,92],45:[98,93],46:[null,95],47:[null,97],48:[null,98],49:[null,99]},
  '4;6-4;11':{19:[1,1],21:[2,2],26:[6,4],27:[8,5],28:[12,6],29:[13,8],30:[14,8],31:[16,10],32:[20,11],33:[22,12],34:[24,13],35:[28,18],36:[31,24],37:[38,28],38:[47,32],39:[56,36],40:[63,40],41:[68,48],42:[72,56],43:[78,62],44:[83,71],45:[88,79],46:[94,84],47:[97,88],48:[98,92],49:[99,94],50:[null,97]},
  '5;0-5;5': {21:[1,1],24:[2,2],27:[4,3],29:[5,4],31:[5,6],32:[5,7],33:[9,10],34:[13,14],35:[16,17],36:[19,20],37:[23,24],38:[32,33],39:[40,39],40:[44,43],42:[52,52],43:[58,65],44:[63,72],46:[68,78],47:[76,86],48:[86,89],49:[92,92],50:[95,96],52:[97,98],53:[99,99]},
  '5;6-5;11':{30:[2,1],32:[3,2],33:[4,3],34:[6,4],35:[7,6],36:[8,9],37:[8,10],38:[9,12],39:[10,15],40:[15,18],41:[20,20],42:[24,26],43:[28,31],44:[32,39],45:[43,48],46:[50,54],47:[58,60],48:[64,68],49:[70,75],50:[84,84],51:[94,93],52:[97,96],53:[98,98],54:[null,99]},
  '6;0-6;5': {42:[5,2],43:[7,6],44:[8,8],45:[10,10],46:[14,12],47:[18,14],48:[20,20],49:[22,25],50:[24,32],51:[25,40],52:[36,44],53:[48,50],54:[60,60],55:[72,70],56:[81,79],57:[88,88],58:[90,94],59:[96,null],60:[98,null]}
};

// PRES 연령 구간 결정 함수
function getPRESAgeGroup(ageMonths) {
  if (ageMonths >= 24 && ageMonths <= 29) return '2;0-2;5';
  if (ageMonths >= 30 && ageMonths <= 35) return '2;6-2;11';
  if (ageMonths >= 36 && ageMonths <= 41) return '3;0-3;5';
  if (ageMonths >= 42 && ageMonths <= 47) return '3;6-3;11';
  if (ageMonths >= 48 && ageMonths <= 53) return '4;0-4;5';
  if (ageMonths >= 54 && ageMonths <= 59) return '4;6-4;11';
  if (ageMonths >= 60 && ageMonths <= 65) return '5;0-5;5';
  if (ageMonths >= 66 && ageMonths <= 71) return '5;6-5;11';
  if (ageMonths >= 72 && ageMonths <= 77) return '6;0-6;5';
  return null;
}

// PRES 룩업: 점수 → 백분위 (가장 가까운 점수 보간)
function lookupPRES(ageMonths, rawScore, type) {
  var grp = getPRESAgeGroup(ageMonths);
  if (!grp) return null;
  var table = PRES_NORMS[grp];
  var typeIdx = type === 'receptive' ? 0 : 1;
  // 정확한 점수 먼저
  if (table[rawScore] !== undefined && table[rawScore][typeIdx] !== null) return table[rawScore][typeIdx];
  // 가장 가까운 낮은 점수 찾기
  var best = null, bestScore = -1;
  Object.keys(table).forEach(function(k) {
    var score = parseInt(k);
    if (score <= rawScore && score > bestScore && table[k][typeIdx] !== null) {
      bestScore = score; best = table[k][typeIdx];
    }
  });
  return best;
}

// ── REVT 등가연령 규준 (표-28 수용어휘) ──
// 점수 → [등가월령, 등가연령 표기]
var REVT_EQ_R = {
  7:'2;6미만',8:'2;6미만',9:'2;6미만',10:'2;6미만',11:'2;6미만',12:'2;6미만',13:'2;6미만',14:'2;6미만',15:'2;6미만',16:'2;6미만',17:'2;6미만',18:'2;6미만',19:'2;6미만',20:'2;6미만',21:'2;6미만',22:'2;6미만',23:'2;6미만',24:'2;6미만',25:'2;6미만',26:'2;6미만',27:'2;6미만',28:'2;6미만',
  29:'2;6-2;8',30:'2;6-2;8',31:'2;6-2;8',32:'2;9-2;11',33:'2;9-2;11',
  34:'3;0-3;5',35:'3;0-3;5',36:'3;0-3;5',37:'3;0-3;5',
  38:'3;6-3;11',39:'3;6-3;11',40:'3;6-3;11',41:'3;6-3;11',42:'3;6-3;11',
  43:'4;0-4;5',44:'4;0-4;5',45:'4;0-4;5',46:'4;0-4;5',47:'4;0-4;5',48:'4;0-4;5',49:'4;0-4;5',50:'4;0-4;5',51:'4;0-4;5',
  52:'4;6-4;11',53:'4;6-4;11',54:'4;6-4;11',55:'4;6-4;11',56:'4;6-4;11',57:'4;6-4;11',58:'4;6-4;11',59:'4;6-4;11',60:'4;6-4;11',
  61:'5;0-5;5',62:'5;0-5;5',63:'5;0-5;5',64:'5;0-5;5',65:'5;0-5;5',66:'5;6-5;11',67:'5;6-5;11',68:'5;6-5;11',69:'5;6-5;11',
  70:'6;0-6;5',71:'6;0-6;5',72:'6;0-6;5',73:'6;0-6;5',74:'6;0-6;5',75:'6;6-6;11',76:'6;6-6;11',77:'6;6-6;11',78:'6;6-6;11',79:'7;0-7;5',80:'7;0-7;5',
  81:'7;0-7;5',82:'7;0-7;5',83:'7;0-7;5',84:'7;6-7;11',85:'7;6-7;11',86:'7;6-7;11',87:'7;6-7;11',88:'8;0-8;5',89:'8;0-8;5',90:'8;0-8;5',91:'8;0-8;5',
  92:'8;0-8;5',93:'8;6-8;11',94:'8;6-8;11',95:'8;6-8;11',96:'8;6-8;11',97:'9;0-9;5',98:'9;0-9;5',99:'9;0-9;5',100:'9;0-9;5',101:'9;0-9;5',102:'9;0-9;5',
  103:'9;0-9;5',104:'9;0-9;5',105:'9;6-9;11',106:'9;6-9;11',107:'9;6-9;11',108:'9;6-9;11',109:'9;6-9;11',110:'9;6-9;11',111:'9;6-9;11',112:'9;6-9;11',113:'9;6-9;11',114:'9;6-9;11',
  115:'9;6-9;11',116:'9;6-9;11',117:'9;6-9;11',118:'9;6-9;11',119:'9;6-9;11',120:'10세',121:'10세',122:'10세',123:'10세',124:'10세',125:'10세',126:'10세',127:'10세',128:'10세',129:'10세',130:'11세',
  131:'11세',132:'11세',133:'11세',134:'11세',135:'11세',136:'11세',137:'11세',138:'11세',139:'11세',140:'11세',141:'11세',142:'11세',143:'12세',144:'12세',145:'12세',146:'12세',147:'12세',148:'12세',149:'12세',150:'12세',151:'15세',152:'16세이상',153:'16세이상',
  154:'16세이상',155:'16세이상',156:'16세이상',157:'16세이상',158:'16세이상',159:'16세이상',160:'16세이상',161:'16세이상',162:'16세이상',163:'16세이상',164:'16세이상',165:'16세이상'
};

// REVT 표현어휘 등가연령 (표-28)
var REVT_EQ_E = {
  7:'2;6미만',8:'2;6미만',9:'2;6미만',10:'2;6미만',11:'2;6미만',12:'2;6미만',13:'2;6미만',14:'2;6미만',15:'2;6미만',16:'2;6미만',17:'2;6미만',18:'2;6미만',19:'2;6미만',20:'2;6미만',21:'2;6미만',22:'2;6미만',23:'2;6미만',24:'2;6미만',25:'2;6미만',26:'2;6미만',27:'2;6미만',28:'2;6미만',
  29:'2;6미만',30:'2;6미만',31:'2;6미만',32:'2;6미만',33:'2;6미만',
  34:'2;6-2;8',35:'2;6-2;8',36:'2;9-2;11',37:'2;9-2;11',
  38:'2;9-2;11',39:'3;0-3;5',40:'3;0-3;5',41:'3;0-3;5',42:'3;0-3;5',43:'3;0-3;5',
  44:'3;0-3;5',45:'3;6-3;11',46:'3;6-3;11',47:'3;6-3;11',48:'4;0-4;5',49:'4;0-4;5',
  50:'4;0-4;5',51:'4;0-4;5',52:'4;0-4;5',53:'4;0-4;5',54:'4;6-4;11',55:'4;6-4;11',56:'4;6-4;11',57:'4;6-4;11',58:'5;0-5;5',59:'5;0-5;5',60:'5;0-5;5',61:'5;0-5;5',62:'5;0-5;5',63:'5;0-5;5',
  64:'5;6-5;11',65:'5;6-5;11',66:'5;6-5;11',67:'5;6-5;11',68:'5;6-5;11',69:'5;6-5;11',70:'5;6-5;11',71:'6;0-6;5',72:'6;0-6;5',73:'6;0-6;5',74:'6;0-6;5',75:'6;0-6;5',76:'6;6-6;11',77:'6;6-6;11',78:'6;6-6;11',79:'6;6-6;11',80:'7;0-7;5',
  81:'7;0-7;5',82:'7;0-7;5',83:'7;0-7;5',84:'7;0-7;5',85:'7;6-7;11',86:'7;6-7;11',87:'7;6-7;11',88:'7;6-7;11',89:'7;6-7;11',90:'7;6-7;11',91:'7;6-7;11',92:'8;0-8;5',93:'8;0-8;5',94:'8;0-8;5',95:'8;0-8;5',96:'8;0-8;5',97:'8;0-8;5',
  98:'8;0-8;5',99:'8;0-8;5',100:'8;6-8;11',101:'8;0-8;5',102:'8;6-8;11',103:'8;6-8;11',104:'8;6-8;11',105:'8;6-8;11',106:'8;6-8;11',107:'9;0-9;5',108:'9;0-9;5',109:'9;0-9;5',110:'9;0-9;5',111:'9;0-9;5',112:'9;0-9;5',113:'9;0-9;5',
  114:'9;6-9;11',115:'9;6-9;11',116:'9;6-9;11',117:'9;6-9;11',118:'9;6-9;11',119:'9;6-9;11',120:'10세',121:'10세',122:'10세',123:'10세',124:'10세',125:'10세',126:'10세',127:'10세',128:'10세',129:'10세',130:'10세',131:'11세',132:'11세',133:'11세',134:'11세',135:'11세',
  136:'11세',137:'11세',138:'11세',139:'11세',140:'11세',141:'11세',142:'11세',143:'12세',144:'12세',145:'12세',146:'12세',147:'12세',148:'12세',149:'12세',150:'12세',151:'15세',152:'16세이상',153:'16세이상'
};

// REVT 연령별 백분위 → 원점수 테이블 (표-29) → 역방향 보간 함수
// 형식: {age_group: [[pct, recep, expr], ...]}
var REVT_PCT_TABLE = {
  '2;6-2;8': [[10,10,7],[20,13,10],[30,14,13],[40,16,16],[50,17,18],[60,18,20],[70,19,22],[80,22,25],[90,24,30],[100,30,41]],
  '2;9-2;11':[[10,12,9],[20,14,16],[30,17,19],[40,17,21],[50,19,22],[60,21,23],[70,22,25],[80,25,32],[90,27,34],[100,33,42]],
  '3;0-3;5': [[10,18,18],[20,22,24],[30,24,28],[40,27,31],[50,29,34],[60,30,36],[70,33,39],[80,36,43],[90,39,48],[100,56,57]],
  '3;6-3;11':[[10,19,26],[20,24,33],[30,27,36],[40,30,39],[50,34,42],[60,36,45],[70,38,48],[80,41,51],[90,44,53],[100,53,59]],
  '4;0-4;5': [[10,29,36],[20,34,42],[30,38,45],[40,41,48],[50,44,50],[60,47,53],[70,49,55],[80,51,57],[90,55,61],[100,62,73]],
  '4;6-4;11':[[10,32,43],[20,38,48],[30,42,52],[40,45,55],[50,47,57],[60,51,58],[70,54,61],[80,57,63],[90,59,66],[100,64,75]],
  '5;0-5;5': [[10,44,50],[20,49,56],[30,51,59],[40,54,62],[50,57,64],[60,59,66],[70,61,67],[80,63,70],[90,67,73],[100,74,82]],
  '5;6-5;11':[[10,50,56],[20,55,62],[30,57,64],[40,59,66],[50,61,68],[60,63,69],[70,64,72],[80,66,74],[90,69,76],[100,78,84]],
  '6;0-6;5': [[10,60,65],[20,64,68],[30,66,71],[40,69,73],[50,70,75],[60,72,77],[70,74,78],[80,77,81],[90,79,83],[100,97,91]],
  '6;6-6;11':[[10,61,64],[20,64,70],[30,68,73],[40,70,76],[50,71,78],[60,74,79],[70,76,81],[80,78,83],[90,82,86],[100,97,90]],
  '7;0-7;5': [[10,74,74],[20,77,77],[30,81,82],[40,83,84],[50,85,86],[60,87,88],[70,88,91],[80,90,93],[90,95,96],[100,100,101]],
  '7;6-7;11':[[10,75,73],[20,80,76],[30,82,81],[40,84,83],[50,87,85],[60,88,88],[70,90,91],[80,94,93],[90,100,98],[100,111,105]],
  '8;0-8;5': [[10,79,77],[20,84,82],[30,86,84],[40,88,88],[50,91,90],[60,93,92],[70,95,94],[80,99,96],[90,104,99],[100,112,106]],
  '8;6-8;11':[[10,80,78],[20,84,82],[30,86,87],[40,89,90],[50,92,93],[60,95,94],[70,99,97],[80,103,99],[90,105,101],[100,111,106]],
  '9;0-9;5': [[10,94,94],[20,98,99],[30,102,102],[40,104,104],[50,107,106],[60,110,108],[70,113,111],[80,117,114],[90,120,116],[100,126,123]],
  '9;6-9;11':[[10,97,94],[20,101,99],[30,105,103],[40,107,106],[50,111,109],[60,113,111],[70,115,115],[80,118,116],[90,122,122],[100,127,127]],
  '10세':     [[10,102,99],[20,105,104],[30,109,108],[40,112,110],[50,114,112],[60,116,114],[70,118,116],[80,120,119],[90,123,121],[100,129,127]],
  '11세':     [[10,119,116],[20,123,122],[30,126,126],[40,128,130],[50,131,133],[60,133,136],[70,135,137],[80,137,140],[90,142,145],[100,152,160]],
  '12세':     [[10,123,121],[20,127,127],[30,129,132],[40,132,135],[50,135,138],[60,137,141],[70,139,144],[80,141,147],[90,145,151],[100,150,161]],
  '13세':     [[10,136,133],[20,140,139],[30,143,143],[40,146,147],[50,149,151],[60,152,154],[70,154,158],[80,157,162],[90,161,166],[100,173,177]],
  '14세':     [[10,137,133],[20,142,141],[30,146,145],[40,149,151],[50,151,153],[60,154,158],[70,156,160],[80,159,165],[90,165,171],[100,171,181]],
  '15세':     [[10,142,142],[20,147,149],[30,149,153],[40,152,156],[50,154,158],[60,158,160],[70,160,162],[80,163,166],[90,166,171],[100,172,181]],
  '16세이상': [[10,151,150],[20,155,154],[30,159,157],[40,161,160],[50,163,162],[60,165,164],[70,167,167],[80,169,170],[90,171,174],[100,175,176]]
};

// REVT 연령 → 백분위 테이블 키 매핑
function getREVTAgeKey(ageMonths) {
  if (ageMonths >= 30 && ageMonths <= 32) return '2;6-2;8';
  if (ageMonths >= 33 && ageMonths <= 35) return '2;9-2;11';
  if (ageMonths >= 36 && ageMonths <= 41) return '3;0-3;5';
  if (ageMonths >= 42 && ageMonths <= 47) return '3;6-3;11';
  if (ageMonths >= 48 && ageMonths <= 53) return '4;0-4;5';
  if (ageMonths >= 54 && ageMonths <= 59) return '4;6-4;11';
  if (ageMonths >= 60 && ageMonths <= 65) return '5;0-5;5';
  if (ageMonths >= 66 && ageMonths <= 71) return '5;6-5;11';
  if (ageMonths >= 72 && ageMonths <= 77) return '6;0-6;5';
  if (ageMonths >= 78 && ageMonths <= 83) return '6;6-6;11';
  if (ageMonths >= 84 && ageMonths <= 89) return '7;0-7;5';
  if (ageMonths >= 90 && ageMonths <= 95) return '7;6-7;11';
  if (ageMonths >= 96 && ageMonths <= 101) return '8;0-8;5';
  if (ageMonths >= 102 && ageMonths <= 107) return '8;6-8;11';
  if (ageMonths >= 108 && ageMonths <= 113) return '9;0-9;5';
  if (ageMonths >= 114 && ageMonths <= 119) return '9;6-9;11';
  if (ageMonths >= 120 && ageMonths <= 131) return '10세';
  if (ageMonths >= 132 && ageMonths <= 143) return '11세';
  if (ageMonths >= 144 && ageMonths <= 155) return '12세';
  if (ageMonths >= 156 && ageMonths <= 167) return '13세';
  if (ageMonths >= 168 && ageMonths <= 179) return '14세';
  if (ageMonths >= 180 && ageMonths <= 191) return '15세';
  if (ageMonths >= 192) return '16세이상';
  return null;
}

// 점수 → 백분위 보간 (백분위 테이블에서 역방향 계산)
function interpolatePct(table, rawScore, colIdx) {
  // colIdx: 1=수용, 2=표현
  for (var i = 0; i < table.length - 1; i++) {
    var lo = table[i], hi = table[i+1];
    var loScore = lo[colIdx], hiScore = hi[colIdx];
    if (rawScore >= loScore && rawScore <= hiScore) {
      if (hiScore === loScore) return lo[0];
      var ratio = (rawScore - loScore) / (hiScore - loScore);
      return Math.round(lo[0] + ratio * (hi[0] - lo[0]));
    }
  }
  // 범위 벗어나면 가장 가까운 값
  if (rawScore <= table[0][colIdx])  return table[0][0];
  if (rawScore >= table[table.length-1][colIdx]) return table[table.length-1][0];
  return null;
}

// ── SELSI 등가연령 규준 (표-34, 35) ──
// 인덱스 = 원점수, 값 = 등가월령 (남자 기준)
var SELSI_EQ_R = [1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,9,9,10,10,11,11,12,12,13,13,14,14,15,15,16,16,17,17,18,19,19,20,20,21,21,22,22,23,23,24,24,25,25,26,26,27,27,28,29,29];
var SELSI_EQ_E = [1,2,2,3,3,4,4,5,5,6,7,7,8,8,9,9,10,10,11,11,12,12,13,14,14,15,15,16,16,17,17,18,18,19,19,20,21,21,22,22,23,23,24,24,25,25,26,26,27,28,28,29,29,30,30];

// SELSI 연령대별 백분위 규준 (표-37): [[pct, 수용점수, 표현점수], ...]
var SELSI_PCT_TABLE = {
  '4-5':   [[1,3,0],[5,3,2],[10,4,3],[15,4,3],[20,5,4],[25,5,4],[30,6,4],[35,6,4],[40,6,5],[45,7,5],[50,7,6],[55,8,6],[60,8,7],[65,8,7],[70,8,8],[75,9,9],[80,10,9],[85,11,10],[90,11,11],[95,12,12],[100,14,14]],
  '6-7':   [[1,2,2],[5,5,4],[10,5,5],[15,6,6],[20,7,7],[25,7,7],[30,8,8],[35,8,8],[40,9,9],[45,9,9],[50,9,10],[55,10,10],[60,11,10],[65,11,11],[70,12,11],[75,12,11],[80,13,12],[85,13,12],[90,14,13],[95,15,15],[100,17,17]],
  '8-9':   [[1,6,3],[5,6,4],[10,9,6],[15,10,9],[20,10,10],[25,11,11],[30,12,12],[35,12,12],[40,13,13],[45,13,13],[50,14,13],[55,14,14],[60,14,14],[65,15,15],[70,16,15],[75,16,16],[80,17,17],[85,18,18],[90,18,20],[95,20,22],[100,22,22]],
  '10-11': [[1,8,11],[5,11,12],[10,12,13],[15,13,13],[20,14,15],[25,15,15],[30,15,16],[35,16,16],[40,17,16],[45,17,17],[50,18,18],[55,18,18],[60,19,19],[65,19,20],[70,20,20],[75,20,21],[80,21,21],[85,22,22],[90,23,24],[95,24,25],[100,26,27]],
  '12-13': [[1,14,11],[5,15,14],[10,16,15],[15,17,17],[20,18,18],[25,19,18],[30,20,19],[35,21,19],[40,21,20],[45,21,21],[50,22,21],[55,22,21],[60,24,22],[65,25,23],[70,26,23],[75,26,24],[80,27,25],[85,27,26],[90,28,27],[95,29,28],[100,31,30]],
  '14-15': [[1,18,14],[5,19,16],[10,22,19],[15,22,20],[20,24,21],[25,25,22],[30,26,22],[35,26,23],[40,27,24],[45,27,24],[50,28,25],[55,28,26],[60,29,27],[65,30,27],[70,31,29],[75,33,29],[80,34,30],[85,34,31],[90,35,32],[95,36,34],[100,36,36]],
  '16-17': [[1,19,18],[5,22,20],[10,26,22],[15,26,24],[20,30,25],[25,30,25],[30,31,27],[35,31,27],[40,32,28],[45,32,29],[50,34,29],[55,35,30],[60,35,31],[65,35,31],[70,36,32],[75,37,32],[80,38,33],[85,38,35],[90,39,37],[95,40,38],[100,40,40]],
  '18-19': [[1,24,21],[5,26,24],[10,28,26],[15,30,28],[20,32,29],[25,33,29],[30,34,30],[35,34,31],[40,35,31],[45,36,32],[50,37,32],[55,38,33],[60,38,35],[65,39,35],[70,40,36],[75,41,38],[80,41,38],[85,41,39],[90,42,39],[95,43,41],[100,44,43]],
  '20-21': [[1,29,24],[5,33,25],[10,34,30],[15,36,32],[20,36,32],[25,37,33],[30,38,34],[35,39,34],[40,40,35],[45,41,36],[50,42,36],[55,43,38],[60,43,39],[65,43,40],[70,44,41],[75,44,42],[80,44,42],[85,44,44],[90,45,46],[95,46,46],[100,46,47]],
  '22-23': [[1,25,26],[5,34,31],[10,37,31],[15,39,33],[20,40,35],[25,41,36],[30,41,37],[35,42,38],[40,42,40],[45,43,41],[50,44,42],[55,45,43],[60,45,44],[65,46,44],[70,46,46],[75,48,47],[80,48,48],[85,49,49],[90,50,50],[95,50,51],[100,51,51]],
  '24-26': [[1,38,36],[5,41,39],[10,43,40],[15,45,41],[20,45,43],[25,45,44],[30,46,44],[35,47,44],[40,47,45],[45,48,46],[50,49,46],[55,50,47],[60,50,47],[65,50,47],[70,51,48],[75,51,48],[80,52,50],[85,52,50],[90,54,51],[95,54,52],[100,56,55]],
  '27-29': [[1,41,40],[5,43,42],[10,46,44],[15,47,45],[20,48,46],[25,48,47],[30,49,47],[35,49,48],[40,49,50],[45,50,50],[50,50,51],[55,51,52],[60,52,52],[65,52,53],[70,53,53],[75,53,54],[80,53,55],[85,54,55],[90,55,56],[95,56,56],[100,56,56]],
  '30-32': [[1,44,42],[5,49,45],[10,50,46],[15,50,48],[20,51,50],[25,51,51],[30,51,52],[35,52,52],[40,52,53],[45,53,53],[50,54,53],[55,54,54],[60,54,54],[65,54,54],[70,55,55],[75,55,55],[80,55,56],[85,56,56],[90,56,56],[95,56,56],[100,56,56]],
  '33-35': [[1,46,46],[5,48,48],[10,50,50],[15,51,51],[20,52,52],[25,52,52],[30,53,53],[35,53,53],[40,54,54],[45,54,54],[50,54,54],[55,55,55],[60,55,55],[65,55,55],[70,56,56],[75,56,56],[80,56,56],[85,56,56],[90,56,56],[95,56,56],[100,56,56]]
};

function getSELSIAgeKey(ageMonths) {
  if (ageMonths >= 4  && ageMonths <= 5)  return '4-5';
  if (ageMonths >= 6  && ageMonths <= 7)  return '6-7';
  if (ageMonths >= 8  && ageMonths <= 9)  return '8-9';
  if (ageMonths >= 10 && ageMonths <= 11) return '10-11';
  if (ageMonths >= 12 && ageMonths <= 13) return '12-13';
  if (ageMonths >= 14 && ageMonths <= 15) return '14-15';
  if (ageMonths >= 16 && ageMonths <= 17) return '16-17';
  if (ageMonths >= 18 && ageMonths <= 19) return '18-19';
  if (ageMonths >= 20 && ageMonths <= 21) return '20-21';
  if (ageMonths >= 22 && ageMonths <= 23) return '22-23';
  if (ageMonths >= 24 && ageMonths <= 26) return '24-26';
  if (ageMonths >= 27 && ageMonths <= 29) return '27-29';
  if (ageMonths >= 30 && ageMonths <= 32) return '30-32';
  if (ageMonths >= 33 && ageMonths <= 35) return '33-35';
  return null;
}

// ── U-TAP 자음정확도 규준 (부록2, 강정태1998) ──
// 전체 기준: mean=평균, sd1=-1SD경계, sd2=-2SD경계
var UTAP_NORMS = {
  2: {mean:94.61, sd1:75.33, sd2:66.05},
  3: {mean:92.25, sd1:86.39, sd2:80.53},
  4: {mean:95.23, sd1:90.76, sd2:86.29},
  5: {mean:97.46, sd1:94.23, sd2:91.00},
  6: {mean:97.90, sd1:95.72, sd2:93.54}
};

function judgeUTAP(ageYears, accuracy) {
  // 7세 이상: 6세 기준 적용
  var key = (ageYears >= 6) ? 6 : ageYears;
  var norm = UTAP_NORMS[key];
  if (!norm) return null;
  if (accuracy >= norm.sd1)  return '정상범위 또는 모니터링 (-1SD 이상)';
  if (accuracy >= norm.sd2)  return '조음치료 고려 (-1SD ~ -2SD)';
  return '조음치료 요망 (-2SD 이하)';
}


// [연령, 원점수] → 백분위 (역방향 룩업)
// 형식: {age: {raw: pct}}
var SYNCOMP_NORMS = {
  4: {2:1,3:2,4:3,5:4,6:5,7:6,8:7,9:8,10:10,11:11,12:12,13:13,14:14,15:15,16:17,17:21,18:23,19:27,20:33,21:37,22:40,23:44,24:47,25:49,26:54,27:60,28:62,29:66,30:69,31:72,32:74,33:80,34:84,35:88,36:90,37:92,38:93,39:94,40:95,41:96,42:97,43:99},
  5: {0:1,1:2,2:2,3:3,4:3,5:4,6:5,7:7,8:8,9:9,10:10,11:11,12:12,13:13,14:14,15:15,16:16,17:17,18:18,19:19,20:20,21:21,22:26,23:30,24:33,25:34,26:37,27:39,28:41,29:43,30:44,31:46,32:48,33:53,34:60,35:64,36:65,37:66,38:69,39:72,40:74,41:75,42:77,43:79,44:80,45:83,46:85,47:87,48:90,49:92,50:94,51:97},
  6: {8:1,9:2,10:3,11:4,12:5,13:7,14:8,15:9,16:10,17:11,18:14,19:15,20:16,21:17,22:18,23:20,24:22,25:24,26:25,27:26,28:28,29:30,30:31,31:33,32:35,33:37,34:38,35:40,36:41,37:44,38:46,39:48,40:50,41:52,42:56,43:58,44:62,45:66,46:68,47:72,48:74,49:76,50:80,51:85,52:89,53:92,54:94,55:96,56:97},
  7: {14:1,15:2,16:3,17:4,18:5,19:7,20:8,21:9,22:10,23:11,24:12,25:14,26:16,27:18,28:20,29:22,30:24,31:26,32:28,33:30,34:32,35:34,36:36,37:38,38:40,39:42,40:44,41:46,42:48,43:50,44:52,45:53,46:56,47:60,48:62,49:64,50:66,51:70,52:72,53:74,54:75,55:78},
  8: {2:1,3:2,17:3,24:4,25:5,28:6,31:7,32:8,33:9,34:10,38:12,39:13,40:14,41:16,42:18,43:19,44:20,45:22,46:24,47:25,48:26,49:28,50:30,51:33,52:37,53:40,54:43,55:46,56:51},
  9: {32:1,33:2,41:4,42:5,43:6,44:7,45:8,46:9,47:10,48:12,49:14,50:18,51:20,52:22,53:24,54:26,55:28,56:30,57:33,58:36,59:40,60:44,61:50,62:52,63:56,64:62,65:68,66:72,67:75,68:78}
};

// ── 언어문제해결력검사 백분위 (연령별) ──
// 형식: {age: [[원점수, 백분위],...]} (총점 기준)
var LANGSOLVE_NORMS = {
  5:  [[4,5],[5,10],[6,15],[7,20],[9,30],[10,40],[11,45],[12,55],[13,60],[14,65],[15,70],[16,75],[17,80],[18,82],[19,85],[21,90],[24,95],[32,100]],
  6:  [[5,5],[8,10],[11,15],[13,20],[14,25],[15,30],[16,35],[18,45],[20,55],[22,60],[23,65],[24,70],[26,75],[28,80],[32,85],[34,90],[40,95],[51,100]],
  7:  [[13,5],[19,10],[21,15],[22,20],[23,25],[24,30],[25,35],[27,40],[28,45],[29,50],[31,55],[31,60],[32,65],[35,70],[36,75],[38,80],[42,85],[47,90],[51,95],[58,100]],
  8:  [[22,5],[24,10],[25,15],[29,20],[32,25],[35,30],[36,35],[37,40],[38,45],[40,50],[40,55],[41,60],[42,65],[44,70],[46,75],[48,80],[50,85],[52,90],[55,95],[73,100]],
  9:  [[27,5],[30,10],[33,15],[36,20],[39,25],[42,30],[43,35],[44,40],[46,45],[47,50],[48,55],[50,60],[53,65],[54,70],[56,75],[57,80],[59,85],[62,90],[66,95],[68,100]],
  10: [[37,5],[41,10],[43,15],[46,20],[47,25],[48,30],[51,35],[53,40],[53,45],[55,50],[55,55],[57,60],[58,65],[60,70],[62,75],[64,80],[66,85],[68,90],[71,95],[77,100]],
  11: [[35,5],[41,10],[46,15],[49,20],[52,25],[53,30],[54,35],[56,40],[57,45],[58,50],[59,55],[60,60],[61,65],[62,70],[62,75],[64,80],[66,85],[71,90],[75,95],[84,100]],
  12: [[41,5],[45,10],[47,15],[48,20],[50,25],[50,30],[51,35],[53,40],[55,45],[57,50],[57,55],[60,60],[61,65],[62,70],[64,75],[67,80],[70,85],[70,90],[72,95],[73,100]]
};

function lookupSynComp(ageYears, raw) {
  var table = SYNCOMP_NORMS[ageYears];
  if (!table) return null;
  if (table[raw] !== undefined) return table[raw];
  // 가장 가까운 낮은 값
  var best = null, bestKey = -1;
  Object.keys(table).forEach(function(k) {
    var score = parseInt(k);
    if (score <= raw && score > bestKey) { bestKey = score; best = table[k]; }
  });
  return best;
}

// ── 생활연령 파싱 (age 문자열 → 개월수) ──
// "7y 3m" (calcLivingAge 출력·검사보고서 표준) 과
// "7세 3개월" (childDB.age DB 저장값) 양쪽 모두 처리
function parseAgeToMonths(ageStr) {
  if (!ageStr) return null;
  // "Xy Xm" / "Xy" 형식 (calcLivingAge 반환값)
  var yMatch = ageStr.match(/^(\d+)y(?:\s*(\d+)m)?/);
  if (yMatch) return parseInt(yMatch[1]) * 12 + (yMatch[2] ? parseInt(yMatch[2]) : 0);
  // "X세 X개월" / "X세" 형식 (DB 저장값)
  var koMatch = ageStr.match(/(\d+)세\s*(?:(\d+)개월)?/);
  if (!koMatch) return null;
  return parseInt(koMatch[1]) * 12 + (koMatch[2] ? parseInt(koMatch[2]) : 0);
}

// ── 통합 자동 계산 함수 ──
function autoCalcAssessScores() {
  if (!getApiKeyOrAlert()) return;
  var childId = String(document.getElementById('assessChild').value || '');
  if (!childId) { showToast('아동을 먼저 선택해주세요.'); return; }
  var child   = childDB.find(function(c) { return c.id === childId; });
  if (!child)  { showToast('아동 정보를 찾을 수 없습니다.'); return; }

  var typeVal = document.getElementById('assessType').value;
  var schema  = ASSESS_SCHEMA[typeVal] || ASSESS_SCHEMA['OTHER'];
  var rawKeys = schema.filter(function(f) {
    return f.key.toLowerCase().includes('raw') || f.key === 'frequency' || f.key === 'duration' || f.key.toLowerCase().includes('accuracy');
  });
  var hasRaw = rawKeys.some(function(f) {
    var el = document.getElementById('af_' + f.key); return el && el.value !== '';
  });
  if (!hasRaw) { showToast('원점수를 먼저 입력해주세요.'); return; }

  // 검사일 기준 연령 우선 (_testAge), 없으면 DB 저장값(child.age) 사용
  var ageMonths = parseAgeToMonths(child._testAge || child.age);
  var ageYears  = ageMonths ? Math.floor(ageMonths / 12) : null;
  var filled    = 0;
  var usedNorm  = false;

  function setField(key, val) {
    if (val === null || val === undefined) return;
    var el = document.getElementById('af_' + key);
    if (el && el.value === '') { el.value = val; filled++; }
  }

  // ── PRES ──
  if (typeVal === 'PRES' && ageMonths) {
    var recRaw = document.getElementById('af_receptiveRaw');
    var expRaw = document.getElementById('af_expressiveRaw');
    if (recRaw && recRaw.value) {
      var recPct = lookupPRES(ageMonths, parseInt(recRaw.value), 'receptive');
      if (recPct !== null) { setField('receptivePct', recPct); usedNorm = true; }
    }
    if (expRaw && expRaw.value) {
      var expPct = lookupPRES(ageMonths, parseInt(expRaw.value), 'expressive');
      if (expPct !== null) { setField('expressivePct', expPct); usedNorm = true; }
    }
  }

  // ── SELSI ──
  if (typeVal === 'SELSI' && ageMonths) {
    var sRecEl = document.getElementById('af_receptiveRaw');
    var sExpEl = document.getElementById('af_expressiveRaw');
    // 등가연령 (표-34, 35)
    if (sRecEl && sRecEl.value !== '') {
      var rv = parseInt(sRecEl.value);
      var eqR = (rv >= 0 && rv < SELSI_EQ_R.length) ? SELSI_EQ_R[rv] + '개월' : null;
      if (eqR) { setField('receptiveEq', eqR); usedNorm = true; }
    }
    if (sExpEl && sExpEl.value !== '') {
      var ev = parseInt(sExpEl.value);
      var eqE = (ev >= 0 && ev < SELSI_EQ_E.length) ? SELSI_EQ_E[ev] + '개월' : null;
      if (eqE) { setField('expressiveEq', eqE); usedNorm = true; }
    }
    // 백분위 (표-37)
    var sKey = getSELSIAgeKey(ageMonths);
    var sTbl = sKey ? SELSI_PCT_TABLE[sKey] : null;
    if (sTbl) {
      if (sRecEl && sRecEl.value !== '') {
        var rPct = interpolatePct(sTbl, parseInt(sRecEl.value), 1);
        if (rPct !== null) { setField('receptivePct', rPct); usedNorm = true; }
      }
      if (sExpEl && sExpEl.value !== '') {
        var ePct = interpolatePct(sTbl, parseInt(sExpEl.value), 2);
        if (ePct !== null) { setField('expressivePct', ePct); usedNorm = true; }
      }
    }
  }

  // ── REVT ──
  if (typeVal === 'REVT') {
    var rRecRaw = document.getElementById('af_receptiveRaw');
    var rExpRaw = document.getElementById('af_expressiveRaw');
    if (rRecRaw && rRecRaw.value) {
      var rvRevt = parseInt(rRecRaw.value);
      var eq = REVT_EQ_R[rvRevt]; if (eq) { setField('receptiveEq', eq); usedNorm = true; }
      if (ageMonths) {
        var key = getREVTAgeKey(ageMonths);
        var tbl = key ? REVT_PCT_TABLE[key] : null;
        if (tbl) { var pct = interpolatePct(tbl, rvRevt, 1); if (pct !== null && pct !== undefined) { setField('receptivePct', pct); usedNorm = true; } }
      }
    }
    if (rExpRaw && rExpRaw.value) {
      var evRevt = parseInt(rExpRaw.value);
      var eeq = REVT_EQ_E[evRevt]; if (eeq) { setField('expressiveEq', eeq); usedNorm = true; }
      if (ageMonths) {
        var ekey = getREVTAgeKey(ageMonths);
        var etbl = ekey ? REVT_PCT_TABLE[ekey] : null;
        if (etbl) { var epct = interpolatePct(etbl, evRevt, 2); if (epct !== null && epct !== undefined) { setField('expressivePct', epct); usedNorm = true; } }
      }
    }
  }

  // ── 구문의미이해력검사 ──
  if (typeVal === 'KMB' && ageYears && ageYears >= 4 && ageYears <= 9) {
    var scRaw = document.getElementById('af_rawScore');
    if (scRaw && scRaw.value) {
      var scPct = lookupSynComp(ageYears, parseInt(scRaw.value));
      if (scPct !== null) { setField('percentile', scPct); usedNorm = true; }
    }
  }

  // ── U-TAP 자음정확도 판정 ──
  if (typeVal === 'UTAP' && ageYears) {
    var wAccEl = document.getElementById('af_wordAccuracy');
    var sAccEl = document.getElementById('af_sentAccuracy');
    if (wAccEl && wAccEl.value !== '') {
      var wJudge = judgeUTAP(ageYears, parseFloat(wAccEl.value));
      if (wJudge) { setField('wordJudge', wJudge); usedNorm = true; }
    }
    if (sAccEl && sAccEl.value !== '') {
      var sJudge = judgeUTAP(ageYears, parseFloat(sAccEl.value));
      if (sJudge) { setField('sentJudge', sJudge); usedNorm = true; }
    }
  }


  // ── 언어문제해결력검사 (PFA 탭에 일시 대응) ──
  if (typeVal === 'PFA' && ageYears && ageYears >= 5 && ageYears <= 12) {
    // P-FA는 말더듬 검사라 규준 구조가 다름 — AI로 처리
  }

  // 규준 데이터로 채워진 항목이 있으면 완료 메시지
  if (filled > 0) {
    showToast('✅ ' + filled + '개 항목 자동 계산 완료! (공식 규준 적용)');
    var noteEl = document.getElementById('assessCalcNote');
    if (noteEl) { noteEl.textContent = '✅ 공식 규준집 데이터 적용 완료'; noteEl.style.display = 'block'; noteEl.style.background = '#f0fdf4'; noteEl.style.color = '#15803d'; noteEl.style.borderLeft = '4px solid #15803d'; }
    usedNorm = true;
  }
  renderSeveritySummary();

  // 원점수가 있지만 규준 테이블이 채워지지 않은 경우 → 연령 범위 초과 안내
  if (!usedNorm && hasRaw && ageMonths && typeVal !== 'OTHER') {
    var _ageYStr = Math.floor(ageMonths / 12) + '세 ' + (ageMonths % 12) + '개월';
    showToast('⚠️ ' + typeVal + ' 규준 연령 범위를 벗어납니다 (아동: ' + _ageYStr + ') — AI 보완으로 진행합니다');
  }

  // 규준 데이터가 없는 항목은 AI로 보완
  var missingFields = schema.filter(function(f) {
    if (f.key.toLowerCase().includes('raw') || f.key.includes('frequency') || f.key === 'duration') return false;
    var el = document.getElementById('af_' + f.key);
    return el && el.value === '';
  });
  if (missingFields.length > 0 && getApiKeyOrAlert()) {
    var btn = document.getElementById('autoCalcBtn');
    if (!btn) return;
    if (btn.dataset.busy === '1') return;
    btn.dataset.busy = '1';
    btn.disabled = true; btn.textContent = '⏳ AI 보완 중...';
    // ES5 호환: .finally() 미지원 환경 대응
    var _resetAutoCalcBtn = function() {
      var b = document.getElementById('autoCalcBtn');
      if (b) { b.dataset.busy = ''; b.disabled = false; b.textContent = '🤖 원점수 → 등가연령·백분위 자동 계산'; }
    };
    var customInp = document.getElementById('assessCustomNameInput');
    var testName = typeVal === 'OTHER' ? (customInp ? customInp.value : '')||'직접입력' : typeVal;
    var rawInputs = rawKeys.map(function(f) { var el=document.getElementById('af_'+f.key); return f.label+': '+(el&&el.value?el.value:'미입력'); }).join(', ');
    var SYSTEM = '당신은 한국 표준화 언어검사 전문가입니다. 공식 규준집을 기반으로 누락된 등가연령/백분위를 계산하세요.\n'
      + 'JSON만 응답: {"results":[{"key":"필드키","val":"값"}]}';
    var USER = '검사: '+testName+', 생활연령: '+(child._testAge||child.age)+', 원점수: '+rawInputs
      + '\n누락 필드: '+missingFields.map(function(f){return f.key+'('+f.label+')'}).join(', ')
      + '\n이미 계산된 값: '+schema.filter(function(f){var el=document.getElementById('af_'+f.key);return el&&el.value;}).map(function(f){var el=document.getElementById('af_'+f.key);return f.label+'='+el.value;}).join(', ');
    callClaude(SYSTEM, USER, 500, getAIModel())
      .then(function(raw) {
        var parsed = parseJSON(raw);
        // parseJSON 은 실패 시 {} 를 반환하므로 !parsed 만으로는 빈 응답을 못 잡음 →
        //   results 유무까지 확인해 AI 가 빈/비정상 응답을 줄 때 사용자에게 피드백.
        if (!parsed || !parsed.results || !parsed.results.length) {
          _resetAutoCalcBtn();
          showToast('⚠️ 자동 계산 결과가 없습니다. 직접 입력해주세요');
          return;
        }
        var aiCount = 0;
        (parsed.results||[]).forEach(function(r) { if(r.key&&r.val){var el=document.getElementById('af_'+r.key);if(el&&el.value===''){el.value=r.val;aiCount++;}} });
        if (aiCount > 0) showToast((filled > 0 ? '+ ' : '') + 'AI로 ' + aiCount + '개 추가 보완');
        if (!usedNorm && aiCount > 0) {
          var n=document.getElementById('assessCalcNote');
          if(n){n.style.display='block';n.textContent='⚠️ AI 추정값 포함 — 공식 규준집으로 확인하세요';}
        }
        renderSeveritySummary();
        _resetAutoCalcBtn();
      })
      .catch(function(e) {
        if(window.console&&console.warn)console.warn('[madi-11 autoCalc]',e&&e.message);
        showToast('❌ 자동 계산 실패 — 다시 시도해주세요');
        _resetAutoCalcBtn();
      });
  } else {
    var b2 = document.getElementById('autoCalcBtn');
    if (b2) { b2.disabled = false; b2.textContent = '🤖 원점수 → 등가연령·백분위 자동 계산'; }
    if (!usedNorm && filled === 0) showToast('⚠️ 이 검사의 규준 데이터가 없습니다. 직접 입력해주세요.');
  }
}

// ── 중증도 자동 판정 ──
var _assessInterpPlain = '';

function getSeverityLabel(pct) {
  if (pct === null || pct === undefined || isNaN(Number(pct))) return null;
  var p = Number(pct);
  if (p >= 25) return { label: '정상 범주', color: '#16a34a', bg: '#f0fdf4' };
  if (p >= 10) return { label: '약도 지체', color: '#d97706', bg: '#fffbeb' };
  if (p >=  3) return { label: '중도 지체', color: '#ea580c', bg: '#fff7ed' };
  return           { label: '심도 지체', color: '#dc2626', bg: '#fef2f2' };
}

function renderSeveritySummary() {
  var panel = document.getElementById('assessSeverityPanel');
  if (!panel) return;
  var typeVal  = document.getElementById('assessType') ? document.getElementById('assessType').value : '';
  var schema   = ASSESS_SCHEMA[typeVal] || ASSESS_SCHEMA['OTHER'];
  var childId  = String((document.getElementById('assessChild') || {}).value || '');
  var child    = childId ? childDB.find(function(c) { return c.id === childId; }) : null;
  var ageStr   = child ? (child._testAge || child.age || '') : '';

  var rows = '';
  var plainParts = [];

  schema.forEach(function(f) {
    var el = document.getElementById('af_' + f.key);
    if (!el || el.value === '') return;

    if (f.label.indexOf('%ile') !== -1) {
      var pct = parseFloat(el.value);
      if (isNaN(pct)) return;
      var sev = getSeverityLabel(pct);
      var domainName = f.label.replace('%ile', '').trim();
      var eqKey = f.key.replace('Pct', 'Eq').replace('percentile', 'eqAge');
      var eqEl  = document.getElementById('af_' + eqKey);
      var eqVal = (eqEl && eqEl.value) ? eqEl.value : '';
      var sevHtml = sev
        ? ' <span style="background:' + sev.bg + ';color:' + sev.color + ';border-radius:4px;padding:1px 8px;font-size:11px;font-weight:700;">' + escHtml(sev.label) + '</span>'
        : '';
      var eqHtml = eqVal ? ' <span style="font-size:11px;color:var(--text2);">/ ' + escHtml(eqVal) + '</span>' : '';
      rows += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;flex-wrap:wrap;">'
        + '<span style="min-width:90px;font-size:12px;color:var(--text2);">' + escHtml(domainName) + '</span>'
        + '<strong style="font-size:12px;">' + pct + '%ile</strong>'
        + eqHtml + sevHtml + '</div>';
      if (sev) plainParts.push(domainName + ' ' + pct + '%ile(' + sev.label + ')');
    }

    if (f.key === 'wordJudge' || f.key === 'sentJudge') {
      var jLabel = f.key === 'wordJudge' ? '낱말수준' : '문장수준';
      rows += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">'
        + '<span style="min-width:90px;font-size:12px;color:var(--text2);">' + escHtml(jLabel) + '</span>'
        + '<strong style="font-size:12px;">' + escHtml(el.value) + '</strong></div>';
      plainParts.push(jLabel + ': ' + el.value);
    }
  });

  if (rows === '') { panel.style.display = 'none'; return; }

  var testLabel  = (typeVal && typeVal !== 'OTHER') ? typeVal + ' 결과 ' : '';
  var childName  = child ? child.name : '';
  _assessInterpPlain = (childName ? childName + '는 만 ' + ageStr + '로, ' : '')
    + testLabel + plainParts.join(', ') + ' 수준입니다.';
  var interpHtml = (childName ? escHtml(childName) + '는 만 ' + escHtml(ageStr) + '로, ' : '')
    + escHtml(testLabel) + escHtml(plainParts.join(', ')) + ' 수준입니다.';

  var html = '<div style="font-size:12px;font-weight:700;margin-bottom:8px;color:var(--text1);">📊 중증도 자동 판정</div>'
    + rows
    + '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">'
    + '<div style="font-size:11px;color:var(--text2);margin-bottom:5px;">📋 해석문 (탭해서 복사)</div>'
    + '<div id="assessInterpText" onclick="copyAssessInterp()" '
    + 'style="cursor:pointer;font-size:12px;line-height:1.7;padding:8px 10px;background:var(--bg);'
    + 'border:1px dashed var(--border);border-radius:8px;">'
    + interpHtml + '</div></div>';

  // eslint-disable-next-line no-unsanitized/property
  panel.innerHTML = html;
  panel.style.display = 'block';
}

function copyAssessInterp() {
  if (!_assessInterpPlain) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(_assessInterpPlain).then(function() {
      showToast('✅ 해석문 복사됨');
    }).catch(function() {
      showToast('⚠️ 복사 실패 — 직접 선택해서 복사해주세요');
    });
  } else {
    showToast('⚠️ 이 브라우저는 자동 복사를 지원하지 않습니다');
  }
}

// ── 저장 + 바로 보고서 생성 ──
function addAndReport() {
  var childId = String(document.getElementById('assessChild').value || '');
  if (!childId) { showToast('아동을 선택해주세요.'); return; }
  addAssessment();
  // 저장 후 보고서 생성 (저장 완료 대기)
  setTimeout(function() { generateAssessReport(); }, 100);
  // 스크롤 이동
  var reportCard = document.getElementById('assessReportResult');
  if (reportCard) reportCard.scrollIntoView({ behavior: 'smooth' });
}

var ASSESS_SCHEMA = {
  'REVT': [
    {key:'receptiveRaw', label:'수용어휘 원점수', type:'num'},
    {key:'receptiveEq',  label:'수용어휘 등가연령', type:'text', ph:'예: 3;6'},
    {key:'receptivePct', label:'수용어휘 %ile', type:'num'},
    {key:'expressiveRaw',label:'표현어휘 원점수', type:'num'},
    {key:'expressiveEq', label:'표현어휘 등가연령', type:'text', ph:'예: 3;6'},
    {key:'expressivePct',label:'표현어휘 %ile', type:'num'}
  ],
  'SELSI': [
    {key:'receptiveRaw', label:'수용언어 원점수', type:'num'},
    {key:'receptiveEq',  label:'수용언어 등가연령', type:'text', ph:'예: 24개월'},
    {key:'receptivePct', label:'수용언어 %ile', type:'num'},
    {key:'expressiveRaw',label:'표현언어 원점수', type:'num'},
    {key:'expressiveEq', label:'표현언어 등가연령', type:'text', ph:'예: 24개월'},
    {key:'expressivePct',label:'표현언어 %ile', type:'num'}
  ],
  'PRES': [
    {key:'receptiveRaw', label:'수용언어 원점수', type:'num'},
    {key:'receptiveEq',  label:'수용언어 등가월령 (직접입력)', type:'text', ph:'예: 36개월', manual:true},
    {key:'receptivePct', label:'수용언어 %ile', type:'num'},
    {key:'expressiveRaw',label:'표현언어 원점수', type:'num'},
    {key:'expressiveEq', label:'표현언어 등가월령 (직접입력)', type:'text', ph:'예: 24개월', manual:true},
    {key:'expressivePct',label:'표현언어 %ile', type:'num'},
    {key:'integratedEq', label:'통합언어 등가월령 (직접입력)', type:'text', ph:'예: 30개월 / 약 6M delayed', manual:true}
  ],
  'UTAP': [
    {key:'wordAccuracy', label:'낱말수준 자음정확도(%)', type:'num', ph:'예: 85.5'},
    {key:'wordJudge',    label:'낱말수준 판정', type:'text', ph:'자동 계산됩니다'},
    {key:'sentAccuracy', label:'문장수준 자음정확도(%)', type:'num', ph:'예: 82.0'},
    {key:'sentJudge',    label:'문장수준 판정', type:'text', ph:'자동 계산됩니다'},
    {key:'errorPatterns', label:'관찰된 음운오류패턴', type:'textarea', ph:'예: 어말종성생략, 치경마찰음 파열음화(ㅅ→ㄷ), 유음 활음화(ㄹ→j) / 비발달적 패턴 없음'}
  ],
  'APAC': [
    {key:'wordRaw',   label:'낱말수준 원점수', type:'num'},
    {key:'wordPct',   label:'낱말수준 %ile', type:'num'},
    {key:'sentRaw',   label:'문장수준 원점수', type:'num'},
    {key:'sentPct',   label:'문장수준 %ile', type:'num'}
  ],
  'PFA': [
    {key:'sld_pct',          label:'SLD% (말더듬유사비유창성)', type:'num',  ph:'예: 8.5',  manual:true},
    {key:'nd_pct',           label:'ND% (정상비유창성)',         type:'num',  ph:'예: 3.2',  manual:true},
    {key:'total_disfluency', label:'총비유창성%',                type:'num',  ph:'예: 11.7', manual:true},
    {key:'spm',              label:'말속도 (SPM, 음절/분)',      type:'num',  ph:'예: 180',  manual:true}
  ],
  'LSSC': [
    {key:'semanticRaw',   label:'의미 원점수', type:'num'},
    {key:'semanticPct',   label:'의미 %ile', type:'num'},
    {key:'grammarRaw',    label:'문법 원점수', type:'num'},
    {key:'grammarPct',    label:'문법 %ile', type:'num'},
    {key:'pragmaticRaw',  label:'화용 원점수', type:'num'},
    {key:'pragmaticPct',  label:'화용 %ile', type:'num'},
    {key:'readingRaw',    label:'읽기 원점수', type:'num'},
    {key:'readingPct',    label:'읽기 %ile', type:'num'},
    {key:'writingRaw',    label:'쓰기 원점수', type:'num'},
    {key:'writingPct',    label:'쓰기 %ile', type:'num'},
    {key:'totalRaw',      label:'전체 원점수', type:'num'},
    {key:'totalPct',      label:'전체 %ile', type:'num'}
  ],
  'KMB': [
    {key:'rawScore',  label:'원점수', type:'num'},
    {key:'eqAge',     label:'등가연령', type:'text', ph:'예: 5;0'},
    {key:'percentile',label:'백분위 %ile', type:'num'}
  ],
  'OTHER': [
    {key:'rawScore',  label:'원점수', type:'num'},
    {key:'eqAge',     label:'등가연령', type:'text', ph:'예: 3;6'},
    {key:'percentile',label:'백분위 %ile', type:'num'}
  ]
};

function renderAssessFields() {
  var t  = document.getElementById('assessType').value;
  var el = document.getElementById('assessFields');
  var cw = document.getElementById('assessCustomNameWrap');
  if (!el) return;
  if (!cw) return;
  cw.style.display = t === 'OTHER' ? 'block' : 'none';
  var schema = ASSESS_SCHEMA[t] || ASSESS_SCHEMA['OTHER'];
  // 2열 그리드로 렌더링 (type:'textarea'인 항목은 전체 너비로 단독 렌더링)
  var rows = '';
  for (var i = 0; i < schema.length; i += 2) {
    var f0 = schema[i];
    if (f0.type === 'textarea') {
      rows += '<div class="form-row" style="margin-bottom:8px;">'
        + '<div style="flex:1;"><label class="form-label" style="font-size:11px;">' + f0.label + '</label>'
        + '<textarea class="form-input" id="af_' + f0.key + '"'
        + (f0.ph ? ' placeholder="' + f0.ph + '"' : '')
        + ' rows="2" style="resize:vertical;width:100%;box-sizing:border-box;font-size:12px;line-height:1.5;"></textarea></div></div>';
      continue;
    }
    rows += '<div class="form-row" style="margin-bottom:8px;">';
    for (var j = i; j < Math.min(i+2, schema.length); j++) {
      var f = schema[j];
      rows += '<div style="flex:1;"><label class="form-label" style="font-size:11px;">' + f.label + '</label>'
        + '<input class="form-input" type="' + f.type + '" id="af_' + f.key + '"'
        + (f.ph ? ' placeholder="' + f.ph + '"' : '') + '></div>';
    }
    rows += '</div>';
  }
  // eslint-disable-next-line no-unsanitized/property
  el.innerHTML = rows;
  var _sp = document.getElementById('assessSeverityPanel');
  if (_sp) _sp.style.display = 'none';
  _assessInterpPlain = '';
}

function getAssessFieldValues() {
  var t = document.getElementById('assessType').value;
  var schema = ASSESS_SCHEMA[t] || ASSESS_SCHEMA['OTHER'];
  var values = {};
  schema.forEach(function(f) {
    var el = document.getElementById('af_' + f.key);
    if (!el) return;
    values[f.key] = f.type === 'num' ? (el.value !== '' ? parseFloat(el.value) : null) : el.value;
  });
  return values;
}

function addAssessment(opts) {
  opts = opts || {};
  var childId  = String(document.getElementById('assessChild').value || '');
  var _dateEl  = document.getElementById('assessDate');
  if (!_dateEl) return false;
  var date     = _dateEl.value;
  var typeVal  = document.getElementById('assessType').value;
  var _customEl = document.getElementById('assessCustomNameInput');
  var testName = typeVal === 'OTHER'
    ? ((_customEl ? _customEl.value.trim() : '') || '직접입력')
    : typeVal;
  var memo     = document.getElementById('assessMemo').value.trim();

  // 자동저장(silent) 모드: 필수값 또는 점수 입력이 없으면 조용히 skip
  var scores = getAssessFieldValues();
  var hasAnyScore = Object.keys(scores).some(function(k) {
    var v = scores[k];
    return v !== null && v !== undefined && String(v).trim() !== '';
  });
  if (opts.silent) {
    if (!childId || !date || !hasAnyScore) return false;  // 자동저장 조건 미달 → 조용히 skip
  } else {
    if (!childId)  { showToast('아동을 선택해주세요.'); return false; }
    if (!date)     { showToast('검사일을 선택해주세요.'); return false; }
  }

  assessmentDB.push({
    id: generateClientId(), childId: childId, date: date,
    testName: testName, typeKey: typeVal,
    scores: scores, memo: memo,
    user_id: (currentUser && currentUser.id) || null
  });
  saveAssess();
  renderAssessmentList();

  if (!opts.silent) {
    document.getElementById('assessMemo').value = '';
    renderAssessFields(); // 필드 초기화
    showToast('✅ 검사 결과 저장 완료!');
  }
  return true;
}

// ── 검사명 변경 시: 이전 입력 자동저장 → 필드 다시 그리기 ──
function onAssessTypeChange() {
  try { addAssessment({ silent: true }); } catch (e) { /* silent: 정상 시나리오 (private mode / 구브라우저 / 옵션 동작) */ }
  renderAssessFields();
}

function formatAssessScores(a) {
  var schema = ASSESS_SCHEMA[a.typeKey] || ASSESS_SCHEMA['OTHER'];
  var scores = a.scores || {};
  var parts = [];
  schema.forEach(function(f) {
    var v = scores[f.key];
    if (v !== null && v !== undefined && v !== '') {
      parts.push('<span style="font-size:11px;color:var(--text2);">' + escHtml(f.label.replace(' 원점수','').replace(' %ile','')) + ':</span> <strong>' + escHtml(String(v)) + '</strong>' + (f.label.includes('%ile') ? '%ile' : ''));
    }
  });
  return parts.length > 0 ? parts.join(' &nbsp;|&nbsp; ') : '점수 없음';
}

function renderAssessmentList() {
  var childId = String(document.getElementById('assessChild').value || '');
  var el = document.getElementById('assessmentList');
  if (!el) return;
  var list = assessmentDB.filter(function(a) { return !childId || a.childId === childId; })
    .sort(function(a,b) { return b.date < a.date ? 1 : -1; });
  if (list.length === 0) { el.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div><p>검사 결과가 없습니다.</p></div>'; return; }
  var html = '';
  list.forEach(function(a) {
    html += '<div class="test-card">'
      + '<div class="test-header"><span class="test-name">' + escHtml(a.testName) + '</span>'
      + '<span class="test-date">📅 ' + escHtml(a.date) + '</span></div>'
      + '<div style="font-size:12px;line-height:1.8;margin-top:6px;">' + formatAssessScores(a) + '</div>'
      + (a.memo ? '<div style="font-size:11px;color:var(--text2);margin-top:5px;">' + escHtml(a.memo) + '</div>' : '')
      + '<button class="btn-del" style="margin-top:8px;" onclick="deleteAssessment(\'' + escHtml(String(a.id || '')) + '\')">삭제</button>'
      + '</div>';
  });
  // eslint-disable-next-line no-unsanitized/property
  el.innerHTML = html;
}

function deleteAssessment(id) {
  if (typeof canDo !== 'function' || !canDo('deleteAssessment')) {
    showToast('⚠️ 검사 삭제 권한이 없습니다');
    return;
  }
  showConfirm('이 검사 결과를 삭제할까요?', function() {
    var backup = assessmentDB.find(function(a) { return a.id === id; });
    var deleteUrl = 'madi_assessments?id=eq.' + id
      + (currentUser && currentUser.center_id ? '&center_id=eq.' + currentUser.center_id : '');
    supaFetch(deleteUrl, 'DELETE').catch(function(e) {
      if(window.console&&console.warn)console.warn('[madi-11 deleteAssessment]',e&&e.message);
      showToast('❌ 검사결과 삭제 실패 — 다시 시도해주세요');
    });
    assessmentDB = assessmentDB.filter(function(a) { return a.id !== id; });
    saveAssess();
    renderAssessmentList();
    showToast('🗑️ 검사결과 삭제됨', {
      undo: function() {
        if (!backup) return;
        // undo 전용 POST 가 검사객체를 data(JSONB)로 래핑하지 않아 최상위 컬럼으로 전송돼
        //   PostgREST 400(조용한 복원 실패·데이터 유실)나던 문제 → 삭제 전 backup 을 메모리에
        //   되돌리고 표준 저장 경로(saveAssess, mapRow 로 data 래핑)로 통째 재저장해 회귀 차단.
        if (!assessmentDB.some(function(a){ return String(a.id) === String(backup.id); })) {
          assessmentDB.push(backup);
        }
        renderAssessmentList();
        saveAssess().then(function(ok) { if (ok !== false) showToast('↩️ 복원됨'); });
      }
    });
  });
}

function generateAssessReport() {
  if (!canDo('useAI')) { showToast('⚠️ AI 기능 사용 권한이 없습니다'); return; }
  if (!getApiKeyOrAlert()) return;
  var childId = String(document.getElementById('assessChild').value || '');
  if (!childId) { showToast('아동을 선택해주세요.'); return; }
  var child = childDB.find(function(c) { return c.id === childId; });
  if (!child) return;

  // ── 자동저장: 현재 입력된 검사 결과가 있으면 먼저 저장 ──
  // assessFields 안에 원점수 등이 입력된 상태라면 addAssessment()를 호출해 저장
  var hasInputData = false;
  var assessFieldsEl = document.getElementById('assessFields');
  if (assessFieldsEl) {
    var inputs = assessFieldsEl.querySelectorAll('input, textarea, select');
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].value && String(inputs[i].value).trim() !== '') { hasInputData = true; break; }
    }
  }
  if (hasInputData && typeof addAssessment === 'function') {
    try { addAssessment({ silent: true }); } catch(e) { /* 저장 실패해도 보고서는 진행 */ }
  }

  var list = assessmentDB.filter(function(a) { return a.childId === childId; })
    .sort(function(a,b) { return a.date < b.date ? -1 : 1; });
  if (list.length === 0) { showToast('검사 결과를 먼저 입력해주세요.'); return; }

  var btn    = document.getElementById('assessReportBtn');
  var result = document.getElementById('assessReportResult');
  if (!btn || !result) return;
  if (btn.dataset.busy === '1') return;
  btn.dataset.busy = '1';
  btn.disabled = true; btn.textContent = '⏳ 보고서 생성 중...';
  result.innerHTML = '<div class="loading"><div class="spinner"></div><p>AI가 검사 결과를 분석 중입니다...</p></div>';

  // 검사 데이터를 상세하게 텍스트로 변환
  var testLog = list.map(function(a) {
    var schema = ASSESS_SCHEMA[a.typeKey] || ASSESS_SCHEMA['OTHER'];
    var scores = a.scores || {};
    var lines = [a.date + ' [' + a.testName + ']'];
    schema.forEach(function(f) {
      var v = scores[f.key];
      if (v !== null && v !== undefined && v !== '') {
        lines.push('  ' + f.label + ': ' + v + (f.label.includes('%ile') ? 'ile' : ''));
      }
    });
    if (a.memo) lines.push('  특이사항: ' + a.memo);
    return lines.join('\n');
  }).join('\n\n');

  var institution   = (document.getElementById('reportInstitution')    || {}).value   || '';
  var evaluator     = (document.getElementById('reportEvaluator')      || {}).value   || '';
  var referral      = (document.getElementById('reportReferralReason') || {}).value   || '';
  // ── 배경정보 4개 필드 통합 (각 라벨과 함께 정리) ──
  var bgPregnancy   = (document.getElementById('reportBgPregnancy')    || {}).value   || '';
  var bgLanguage    = (document.getElementById('reportBgLanguage')     || {}).value   || '';
  var bgPhysical    = (document.getElementById('reportBgPhysical')     || {}).value   || '';
  var bgTreatment   = (document.getElementById('reportBgTreatment')    || {}).value   || '';
  var backgroundParts = [];
  if (bgPregnancy.trim()) backgroundParts.push('· 임신·출산: ' + bgPregnancy.trim());
  if (bgPhysical.trim())  backgroundParts.push('· 신체발달력: ' + bgPhysical.trim());
  if (bgLanguage.trim())  backgroundParts.push('· 언어발달력: ' + bgLanguage.trim());
  if (bgTreatment.trim()) backgroundParts.push('· 이전 평가·치료력: ' + bgTreatment.trim());
  var background    = backgroundParts.join('\n');
  var testBehavior  = (document.getElementById('reportTestBehavior')   || {}).value   || '';

  var SYSTEM = '당신은 15년 이상 경력의 대한민국 1급 언어재활사입니다.\n'
    + '아래 정보를 바탕으로 실제 임상 현장에서 사용하는 전문 말·언어 평가보고서를 작성하세요.\n\n'
    + '【보고서 구조 — 반드시 이 순서와 제목을 사용하세요】\n\n'
    + 'I. 배경정보\n'
    + '- 의뢰 사유로 시작. "본 대상자는 [사유]를 위하여 본 기관에 내원하였음." 형식\n'
    + '- 출생 및 산모 정보 (임신 특이사항, 산모 연령, 출산 주수·체중·출생 순서)\n'
    + '- 신체발달력 (배밀이, 걷기, 뛰기, 배변 훈련)\n'
    + '- 언어발달력 (첫 낱말, 첫 문장, 현재 언어 수준)\n'
    + '- 이전 치료력 (기관명·기간·치료 종류)\n'
    + '- 제공된 정보가 없는 항목은 일반적 임상 문체로 간략히 처리\n\n'
    + 'II. 검사태도\n'
    + '- 의사소통 방식, eye contact 빈도, 협조도, 집중력, 특이 행동 관찰 내용 서술\n'
    + '- 제공된 정보가 없으면 "전반적으로 협조적이었으며, 검사 지시에 잘 따랐음." 수준으로 기술\n\n'
    + 'III. 실시한 검사\n'
    + '- 번호 목록 형식 (예: 1. 수용 및 표현 어휘력 검사(REVT))\n\n'
    + 'IV. 검사결과\n'
    + '1. 말·언어 능력\n'
    + '각 검사마다 아래 형식으로 작성:\n'
    + '  가. [검사명 풀네임(약자)]\n'
    + '  - 마크다운 표: | 평가도구/영역 | 원점수(점) | 등가연령 | 백분위수(%ile) | 비고 |\n'
    + '  - 오반응 문항: 있을 경우 "오반응 문항: 수용 - ..., 표현 - ..." 형식\n'
    + '  - 서술형 해석: "- [검사명] 검사결과, [번호-세부번호]) [영역] [수치] [수준 판정]으로 평가됨." 형식\n\n'
    + 'V. 요약 및 결론\n'
    + '- 각 검사 핵심 결과 요약 (불릿 포인트)\n'
    + '- 진단명 (예: 수용 및 표현언어발달지연(Receptive-Expressive Language Developmental Delay))\n'
    + '- 관찰된 주요 특성들 (불릿 포인트)\n'
    + '- 치료 필요성 및 방향 기술\n\n'
    + 'VI. 제언\n'
    + '- 치료 목표 영역 및 구체적 목표 행동 (의미·문법·화용·담화 등)\n'
    + '- 치료 형태 및 빈도 (주 N회 개별/그룹)\n'
    + '- 가정 연계 지도 방향\n\n'
    + '【작성 지침】\n'
    + '- JSON 없이 보고서 형식으로 작성\n'
    + '- 마크다운 표(|) 형식으로 검사 결과 제시\n'
    + '- 전문 문어체 경어(~함, ~됨, ~임)\n'
    + '- 각 섹션 제목은 "I. 배경정보", "II. 검사태도" 형식 유지\n'
    + '- 등가연령 범위 표기 시 "X세 X-X개월" 또는 "XM" 형식\n'
    + '- ** 또는 * 마크다운 볼드/이탤릭 절대 사용 금지. 강조는 섹션 제목(로마 숫자, 가나다 번호)으로만 할 것\n'
    + '- 검사명 표기 규칙: U-TAP은 반드시 "우리말 조음·음운 평가(U-TAP)"으로만 표기. "UTAP2", "U-TAP2", "U-TAP-2" 등 숫자 붙인 표기 절대 금지\n'
    + '- PRES 검사에서 등가월령은 제공된 값을 그대로 사용하고 임의로 수정하지 말 것\n\n'
    + '【조음 오류 분석 — 조음음운장애 또는 U-TAP/APAC 등 음운 검사가 실시된 경우 IV. 검사결과에 필수 포함】\n'
    + '- 각 오류 음소마다 다음을 모두 기술:\n'
    + '  (1) 목표음 → 오류음 (예: "사탕→타탕, ㅅ→ㅌ")\n'
    + '  (2) 적용되는 오류 패턴을 모두 나열 — 한 오류가 여러 패턴을 동시에 가지면 모두 명시\n'
    + '      예: "ㅈ→ㅌ은 파열음화(파찰음→파열음)인 동시에 전방화(치경경구개음→치경음)에 해당함"\n'
    + '  (3) 발달적 오류 vs 비발달적 오류 판단 — 아동의 생활연령과 한국 음운 발달 기준 대조\n'
    + '      한국 음소 안정화(90% 정조음): ㅂㅁㄴㅇ ~2세, ㄷㅌ ~3세, ㄱㅋㅎ ~3.5세, ㅈㅊ ~4.5세, ㅅㅆ ~5세, ㄹ ~6세\n'
    + '      오류 패턴 일반 소실 연령: 파열음화·전방화 ~4세, 후방화·마찰음화·초성생략 ~3세, 활음화 ~5세, 자음군축약 ~6세\n'
    + '  (4) 자극반응도(SR) 또는 일관성 코멘트 (정보 있을 때)\n'
    + '- U-TAP 음운오류패턴 분류 체계 (U-TAP 실시 시 이 분류로 기술):\n'
    + '  · 음절구조변동: 음절생략 / 이중초성생략 / 어말종성생략\n'
    + '  · 대치변동 — 유음 오류: 유음생략 / 활음화 / 비음화 / 파열음화\n'
    + '  · 대치변동 — 치경마찰음 오류: 파열음화(ㅅ·ㅆ→파열음) / 파찰음화(ㅅ·ㅆ→파찰음)\n'
    + '  · 대치변동 — 파찰음 오류: 파열음화(파찰음→파열음) / 연구개음 전방화\n'
    + '  · 대치변동 — 경음화: 평음의 경음화 / 격음의 경음화\n'
    + '  · 대치변동 — 동화: 이중초성 역행동화\n'
    + '  · 기타변동 — 약모음: 치경마찰음의 치(간)음화 / 치경마찰음의 경구개음화 / 치경마찰음의 설측음화 / 탄설음의 설측음화\n'
    + '  · 기타변동 — 모음: 단모음화\n'
    + '  · 비발달적 음운오류패턴: 2회 이상 관찰된 기타 오류는 별도로 기재\n'
    + '- 표준 용어만 사용: "파열음화"(중지화/폐쇄음화/저해음화 X), 전방화, 연구개음 전방화, 후방화, 마찰음화, 파찰음화, 활음화, 비음화, 탈비음화, 경음화, 치(간)음화, 설측음화, 단모음화, 음절생략, 어말종성생략, 이중초성생략, 유음생략, 종성생략, 초성생략, 자음군축약, 역행동화, 이중초성 역행동화\n'
    + '- 오류 분석 표 예시 형식:\n'
    + '  | 목표 → 오류 | 적용 오류 패턴 | 발달성 판단 |\n'
    + '  | 사탕→타탕 (ㅅ→ㅌ) | 파열음화 | 만 4세 이후이므로 비발달적 |\n'
    + '  | 자동차→타동타 (ㅈ→ㅌ) | 파열음화 + 전방화 | 만 4세 이후이므로 비발달적 |'
    + '\n\n'
    // 현업 임상 보고서 스타일 가이드 — madi-vocab.js 의 익명화된 예시 부착
    + ((typeof getReportStyleGuide === 'function') ? getReportStyleGuide('language') : '')
    + AI_NAME_RULE;

  var USER = '【아동 정보】\n'
    + '이름: ' + aliasName() + '\n'
    + '생활연령: ' + (child._testAge || child.age) + '\n'
    + '장애유형: ' + child.type + '\n'
    + (institution  ? '기관명: ' + institution + '\n' : '')
    + (evaluator    ? '평가자: ' + evaluator + '\n' : '')
    + '\n【의뢰 사유】\n' + (referral || '현행 수준 파악을 위해 내원')
    + '\n\n【배경정보】\n' + (background || '(배경정보 미입력 — 일반적 임상 문체로 작성)')
    + '\n\n【검사태도 및 행동 관찰】\n' + (testBehavior || '(검사태도 미입력 — 일반적 협조적 수준으로 작성)')
    + '\n\n【검사 결과】\n' + testLog;

  callClaude(SYSTEM, USER, 3000, getAIModel())
    .then(function(raw) {
      // ** 마크다운 볼드/이탤릭 제거
      raw = raw.replace(/\*\*([^*\n]+)\*\*/g, '$1').replace(/\*([^*\n]+)\*/g, '$1');
      // UTAP2 → U-TAP 자동 교체
      raw = raw.replace(/U-TAP-?2/g, 'U-TAP').replace(/UTAP-?2/g, 'U-TAP');
      // 임상 표준 용어 통일: "중지화"→"파열음화" 등 (audience: clinical)
      if (typeof sanitizeSLPOutput === 'function') raw = sanitizeSLPOutput(raw, 'clinical');
      raw = restoreName(raw, child.name);  // 가명 ○○ → 실명 복원 (H1)
      var cn = escHtml(child.name);
      // eslint-disable-next-line no-unsanitized/property
      result.innerHTML = '<div id="assessReportText" contenteditable="false" class="report-box"'
        + ' style="white-space:pre-wrap;outline:none;cursor:text;transition:border 0.2s,background 0.2s;">'
        + escHtml(raw) + '</div>'
        + '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">'
        + '<button class="btn-ghost" id="editToggleBtn" onclick="toggleReportEdit()" style="white-space:nowrap;padding:11px 14px;">✏️ 내용 편집</button>'
        + '<button class="pdf-btn" style="flex:1;" onclick="downloadAssessPDF(\'' + cn + '\')">⬇️ PDF 출력</button>'
        + '<button class="btn-outline" style="flex:1;padding:11px 16px;" onclick="downloadWordDoc(\'' + cn + '\')">📝 HWP/Word</button>'
        + '</div>';
    })
    .then(function(){ btn.dataset.busy = ''; btn.disabled = false; btn.textContent = '🤖 AI 평가 보고서 생성'; })
    .catch(function(err) {
      if(window.console&&console.warn)console.warn('[AI 평가보고서]',err&&err.message);
      // eslint-disable-next-line no-unsanitized/property
      result.innerHTML = '<div style="background:#fef2f2;border-radius:12px;padding:14px;"><p style="color:#dc2626;font-size:13px;">⚠️ ' + escHtml(_userErrMsg(err, 'AI 평가 보고서 생성')) + '</p></div>';
      btn.dataset.busy = ''; btn.disabled = false; btn.textContent = '🤖 AI 평가 보고서 생성';
    });
}

// ─────── 부모 교육 자료 ───────
function generateParentEdu() {
  if (!canDo('useAI')) { showToast('⚠️ AI 기능 사용 권한이 없습니다'); return; }
  if (!getApiKeyOrAlert()) return;
  var childId = String(document.getElementById('eduChild').value || '');
  if (!childId) { showToast('아동을 선택해주세요.'); return; }

  var child   = childDB.find(function(c) { return c.id === childId; });
  var sessions = sessionDB.filter(function(s) { return s.childId === childId; })
    .sort(function(a, b) { return a.date < b.date ? -1 : 1; }).slice(-3);

  var btn    = document.getElementById('eduBtn');
  var result = document.getElementById('eduResult');
  if (!btn || !result) return;
  if (btn.dataset.busy === '1') return;
  btn.dataset.busy = '1';
  btn.disabled = true; btn.textContent = '⏳ 생성 중...';
  result.innerHTML = '<div class="loading"><div class="spinner"></div><p>부모 교육 자료를 생성 중입니다...</p></div>';

  var sessionSummary = sessions.map(function(s) {
    var g = (s.goals||[]).map(function(g){return g.name+(g.score!==null?' '+g.score+'%':'');}).join(', ');
    return s.date + ': [' + g + '] ' + (s.memo || '');
  }).join('\n');

  var _parentGuide = (typeof SLP_PROMPT_PARENT_GUIDE !== 'undefined') ? SLP_PROMPT_PARENT_GUIDE : '';
  var SYSTEM = '당신은 한국 언어치료 임상 현장의 베테랑 언어재활사입니다. 아동의 최근 치료 내용을 바탕으로 부모가 집에서 실천할 수 있는 교육 자료를 작성하세요.\n'
    + 'A4 한 장 분량으로 구성:\n'
    + '1. 이번 주 치료에서 잘 된 것 (칭찬 포인트)\n'
    + '2. 이번 주 집에서 할 활동 3가지 (각각 제목 + 방법 + 소요 시간)\n'
    + '3. 부모님께 드리는 한마디\n'
    + '따뜻하고 실용적인 말투로, 부모가 바로 활용할 수 있게 작성하세요. JSON 없이 텍스트로.\n\n'
    + _parentGuide + AI_NAME_RULE;
  var USER = '아동: ' + aliasName() + ' (' + (child._testAge||child.age) + ', ' + child.type + ')\n치료 목표: ' + ((child.goals || []).join(', ')||'없음')
    + '\n\n최근 세션:\n' + (sessionSummary || '세션 기록 없음');

  callClaude(SYSTEM, USER, 1500, getAIModel())
    .then(function(raw) {
      // 학부모용 — 한자어·비표준 용어 자동 치환
      if (typeof sanitizeSLPOutput === 'function') raw = sanitizeSLPOutput(raw, 'parent');
      raw = restoreName(raw, child.name);  // 가명 ○○ → 실명 복원 (H1)
      result.innerHTML = '<div class="parent-edu-preview" id="eduText">' + escHtml(raw) + '</div>'
        + '<button class="print-btn" onclick="printParentEdu(\'' + escHtml(child.name) + '\')">🖨️ 인쇄하기</button>';
    })
    .then(function(){ btn.dataset.busy = ''; btn.disabled = false; btn.textContent = '🖨️ 부모 교육 자료 생성'; })
    .catch(function(err) {
      if(window.console&&console.warn)console.warn('[부모 교육자료]',err&&err.message);
      result.innerHTML = '<div style="background:#fef2f2;border-radius:12px;padding:14px;"><p style="color:#dc2626;font-size:13px;">⚠️ ' + escHtml(_userErrMsg(err, '부모 교육 자료 생성')) + '</p></div>';
      btn.dataset.busy = ''; btn.disabled = false; btn.textContent = '🖨️ 부모 교육 자료 생성';
    });
}

function printParentEdu(childName) {
  var el = document.getElementById('eduText');
  if (!el) return;
  var today = new Date().toLocaleDateString('ko-KR');
  var win = window.open('', '_blank');
  if (!win) { showToast('⚠️ 팝업이 차단됐습니다. 팝업 허용 후 다시 시도해주세요.'); return; }
  // eslint-disable-next-line no-unsanitized/method
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8">'
    + '<style>'
    + '@import url("https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap");'
    + 'body{font-family:"Noto Sans KR",sans-serif;padding:40px;color:#1e293b;line-height:1.9;max-width:700px;margin:0 auto;}'
    + 'h1{color:#0ea5a0;font-size:20px;border-bottom:3px solid #0ea5a0;padding-bottom:8px;margin-bottom:20px;}'
    + '.meta{font-size:13px;color:#64748b;margin-bottom:24px;}'
    + 'pre{white-space:pre-wrap;font-family:"Noto Sans KR",sans-serif;font-size:14px;}'
    + '.footer{margin-top:40px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px;text-align:center;}'
    + '@media print{body{padding:20px;} .footer{position:fixed;bottom:10px;width:100%;}}'
    + '</style></head><body>'
    + '<h1>🏠 ' + escHtml(childName || '') + ' 가정 교육 자료</h1>'
    + '<div class="meta">작성일: ' + today + ' | 마디(Madi) 언어치료</div>'
    + '<pre>' + el.textContent.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</pre>'
    + '<div class="footer">본 자료는 마디(Madi) AI가 보조 작성한 가정 교육 자료입니다.</div>'
    + '</body></html>');
  win.document.close();
  setTimeout(function() { win.print(); }, 500);
  showToast('🖨️ 인쇄 창이 열렸습니다!');
}

// ─────── 데이터 이전 ───────