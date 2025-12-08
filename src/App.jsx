import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Building2, FileText, CheckCircle2, CheckCircle, Layout, Home, Search, User, 
  Loader2, ChevronDown, Baby, TrendingUp, AlertTriangle, AlertCircle, Target, Info, 
  Smartphone, Sun, Moon, Users, Accessibility, HandCoins, HeartHandshake, 
  Filter, X, Menu, BarChart2
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, ComposedChart, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, LabelList
} from 'recharts';

// --- LOGO 設定 (目前尚未使用，可之後接 logo 檔) ---
const LOGO_URL = "/綜合規劃股儀表板logo.jpg"; 

// ==========================================
// 共用工具函式
// ==========================================
const parseNumber = (v) => {
  if (v === undefined || v === null || v === '') return 0;
  const str = String(v).replace(/,/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const normalizeDistrict = (name) => {
  if (!name) return '';
  return String(name)
    .trim()
    .replace(/臺/g, '台')
    .replace(/^台北市/, '')
    .replace(/台彎省/, '')
    .replace(/\s+/g, '')
    .replace(/區$/, '');
};

const parseData = (text, headerKeyword = null) => {
  if (!text) return [];
  let lines = text.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  let separator = lines[0].includes('\t') ? '\t' : ',';

  // 若指定 header 關鍵字，就從該列開始解析
  if (headerKeyword) {
    const headerIndex = lines.findIndex(line => line.includes(headerKeyword));
    if (headerIndex !== -1) {
      lines = lines.slice(headerIndex);
      separator = lines[0].includes('\t') ? '\t' : ',';
    }
  }

  const parseLine = (line) => {
    const result = [];
    let start = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') inQuotes = !inQuotes;
      else if (line[i] === separator && !inQuotes) {
        let val = line.substring(start, i);
        val = val.replace(/^"|"$/g, '').replace(/^\uFEFF/, '').trim();
        result.push(val);
        start = i + 1;
      }
    }
    let lastVal = line.substring(start);
    lastVal = lastVal.replace(/^"|"$/g, '').replace(/^\uFEFF/, '').trim();
    result.push(lastVal);
    return result;
  };

  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseLine(line);
    const entry = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.replace(/^\uFEFF/, '').trim();
      if (cleanHeader) entry[cleanHeader] = values[index] || '';
    });
    return entry;
  });
};

const parseCellB15 = (text) => {
  if (!text) return 0;
  const lines = text.split('\n');
  if (lines.length < 15) return 0; 
  const line15 = lines[14]; 
  const separator = line15.includes('\t') ? '\t' : ',';
  const cols = line15.split(separator);
  if (cols.length > 1) return parseNumber((cols[1] || '').replace(/^"|"$/g, ''));
  return 0;
};

// 專用解析器：人口資料 (確保讀取 H 欄)
const parsePopulationData = (text) => {
  if (!text) return [];
  let lines = text.split('\n').filter(line => line.trim() !== '');
  const headerIndex = lines.findIndex(line => line.includes('行政區'));
  if (headerIndex === -1) return [];
  lines = lines.slice(headerIndex);

  const separator = lines[0].includes('\t') ? '\t' : ',';

  const parseLine = (line) => {
    const result = [];
    let start = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') inQuotes = !inQuotes;
      else if (line[i] === separator && !inQuotes) {
        result.push(line.substring(start, i).replace(/^"|"$/g, '').trim());
        start = i + 1;
      }
    }
    result.push(line.substring(start).replace(/^"|"$/g, '').trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => {
    const cols = parseLine(line);
    const entry = {};
    headers.forEach((h, i) => {
      const cleanH = h.replace(/^\uFEFF/, '').trim();
      if (cleanH) entry[cleanH] = cols[i] || '';
    });
    // 額外保留 H 欄原始值
    if (cols.length > 7) entry['raw_col_h'] = cols[7]; // H 欄 Index 7
    return entry;
  });
};

// === 社宅弱勢專用 CSV 工具 ===
// A=0, B=1, ... Z=25
const letterToIndex = (letter) => letter.toUpperCase().charCodeAt(0) - 65;

// 原始 CSV → { headers:[], rows:[[]] }
const parseCsvRaw = (text) => {
  if (!text) return { headers: [], rows: [] };
  let lines = text.split('\n').filter((line) => line.trim() !== '');
  if (!lines.length) return { headers: [], rows: [] };

  const separator = lines[0].includes('\t') ? '\t' : ',';

  const parseLine = (line) => {
    const result = [];
    let start = 0;
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === separator && !inQuotes) {
        let val = line.substring(start, i);
        val = val.replace(/^"|"$/g, '').replace(/^\uFEFF/, '').trim();
        result.push(val);
        start = i + 1;
      }
    }
    let lastVal = line.substring(start);
    lastVal = lastVal.replace(/^"|"$/g, '').replace(/^\uFEFF/, '').trim();
    result.push(lastVal);

    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
};

// 優先用標題關鍵字找欄，找不到就用欄位字母當 fallback
const findIndexByKeyword = (headers, keywords, fallbackLetter) => {
  let idx = headers.findIndex((h) => {
    const clean = (h || '').replace(/\s/g, '');
    return keywords.some((k) => clean.includes(k));
  });
  if (idx !== -1) return idx;
  if (fallbackLetter) return letterToIndex(fallbackLetter);
  return -1;
};

// ==========================================
// 子元件：社福設施 (WelfareDashboard) — 原樣保留
// ==========================================
const WelfareDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [csvData, setCsvData] = useState([]); 
  const [popData, setPopData] = useState([]);
  const [childcareNowData, setChildcareNowData] = useState([]);
  const [childcareFutureData, setChildcareFutureData] = useState([]);
  const [telecomData, setTelecomData] = useState([]); 
  const [popFutureTotal, setPopFutureTotal] = useState(0); 
  
  const [pmSearchTerm, setPmSearchTerm] = useState('');
  const [selectedBase, setSelectedBase] = useState(null); 
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const handleSelectBase = (item) => {
    setPmSearchTerm(item.baseName);
    setSelectedBase(item);
    setIsDropdownOpen(false);
  };

  const toggleDropdown = () => {
    if (!isDropdownOpen) setPmSearchTerm('');
    setIsDropdownOpen(!isDropdownOpen);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const urls = [
          'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=0&single=true&output=csv',
          'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=513929673&single=true&output=csv',
          'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=951116094&single=true&output=csv',
          'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=47182957&single=true&output=csv',
          'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=1074300767&single=true&output=csv',
          'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=1894885880&single=true&output=csv'
        ];
        const responses = await Promise.all(urls.map(url => fetch(url).then(r => r.text())));
        
        setCsvData(parseData(responses[0]));
        setPopData(parsePopulationData(responses[1]));
        setChildcareNowData(parseData(responses[2]));
        setChildcareFutureData(parseData(responses[3]));
        setPopFutureTotal(parseCellB15(responses[4]));
        setTelecomData(parseData(responses[5]));
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();

    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) 
        setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const processedData = useMemo(() => {
    if (csvData.length === 0) return [];
    const findKey = (obj, keywords) => 
      Object.keys(obj).find(k => keywords.some(w => k.replace(/\s/g,'').includes(w)));
    const firstRow = csvData[0];
    const keys = {
      baseName: findKey(firstRow, ['基地名稱']),
      pmName:   findKey(firstRow, ['PM']),
      id:       findKey(firstRow, ['機構代碼']),
      type:     findKey(firstRow, ['辦理類型']),
      startYear:findKey(firstRow, ['開辦年度']),
      status:   findKey(firstRow, ['開辦狀態','是否開辦']),
    };
    return csvData.map(row => ({
      baseName: row[keys.baseName] || '',
      pmName:   row[keys.pmName] || '',
      id:       row[keys.id],
      type:     row[keys.type],
      startYear: parseInt(row[keys.startYear]) || null,
      status:   (row[keys.status] || '').trim(),
    }));
  }, [csvData]);

  const baseList = useMemo(
    () => processedData
      .filter(i => i.baseName.trim() && i.pmName.trim())
      .filter((i, idx, self) => idx === self.findIndex(t => t.baseName === i.baseName)),
    [processedData]
  );
  
  const filteredBases = useMemo(
    () => pmSearchTerm ? baseList.filter(i => i.baseName.includes(pmSearchTerm)) : baseList,
    [baseList, pmSearchTerm]
  );

  const stats = useMemo(() => {
    if (csvData.length === 0) return { total: 0, labor: 0, commission: 0, program: 0 };
    // 目前先用固定值（若要動態計算可再調整）
    return { total: 305, labor: 165, commission: 127, program: 16 };
  }, [csvData]);

  const trendData = useMemo(() => {
    if (processedData.length === 0) return [];
    const startRange = 110, endRange = 123;
    const result = [];
    const targetTypes = ["公辦民營(勞務)", "公辦民營(委營)", "方案委託(帶地投標)"];

    for (let year = startRange; year <= endRange; year++) {
      let activeSet = new Set(), newSet = new Set();
      processedData.forEach(item => {
        if (!targetTypes.includes(item.type) || !item.id || !item.startYear) return;
        const hasStarted = item.startYear <= year;
        if (hasStarted) activeSet.add(item.id);
        if (item.startYear === year) newSet.add(item.id);
      });
      result.push({ year: `${year}年`, cumulative: activeSet.size, new: newSet.size });
    }
    return result;
  }, [processedData]);

  const { districtSummary, cityStats, cumulativeTrend } = useMemo(() => {
    const safeDefault = { 
      districtSummary: [], 
      cityStats: { coverageNow: 0, coverageFuture: 0, popNow: 0, popFuture: 0, capNow: 0, capFuture: 0 }, 
      cumulativeTrend: [] 
    };

    if (popData.length === 0) return safeDefault;

    const getVal = (obj, kw) => {
      const k = Object.keys(obj).find(k => kw.some(w => k.includes(w)));
      return k ? parseNumber(obj[k]) : 0;
    };
    const getStr = (obj, kw) => {
      const k = Object.keys(obj).find(k => kw.some(w => k.includes(w)));
      return k ? String(obj[k]).trim() : '';
    };

    const districtMap = {};
    popData.forEach(row => {
      const rawDist = getStr(row, ['行政區', '區別']);
      if (!rawDist || rawDist.includes('總計')) return;
      const normDist = normalizeDistrict(rawDist);
      if (!normDist) return;
      const pop0 = getVal(row, ['0歲']);
      const pop1 = getVal(row, ['1歲']);
      
      if (!districtMap[normDist]) {
        districtMap[normDist] = { 
          district: rawDist, 
          popNow: 0, popFuture: 0, 
          capacityNow: 0, futureCapacity: 0, 
          telecom: { day:0, night:0 } 
        };
      }
      districtMap[normDist].popNow += (pop0 + pop1);
      districtMap[normDist].popFuture += parseNumber(row['raw_col_h']); 
    });
    
    const totalPopNow = Object.values(districtMap).reduce((a,b)=>a+b.popNow,0);
    const growthRate = popFutureTotal > 0 ? popFutureTotal / totalPopNow : 0.92;
    Object.values(districtMap).forEach(d => {
      if (d.popFuture === 0) d.popFuture = Math.round(d.popNow * growthRate);
    });

    let cityCapNow = 0, cityCapFut = 0;
    childcareNowData.forEach(row => {
      const d = normalizeDistrict(getStr(row, ['行政區']));
      const cap = getVal(row, ['收托']);
      if (districtMap[d]) {
        districtMap[d].capacityNow += cap; 
        cityCapNow += cap;
      }
    });

    const futureByYear = {};
    childcareFutureData.forEach(row => {
      const d = normalizeDistrict(getStr(row, ['行政區']));
      const cap = getVal(row, ['收托']);
      const y = parseInt(getStr(row, ['年度']).replace(/\D/g,'')) || 115;
      if (districtMap[d]) {
        districtMap[d].futureCapacity += cap; 
        cityCapFut += cap;
      }
      if (y>=114 && y<=118) futureByYear[y] = (futureByYear[y]||0)+cap;
    });

    telecomData.forEach(row => {
      const d = normalizeDistrict(getStr(row, ['行政區']));
      if (districtMap[d]) {
        districtMap[d].telecom.night = getVal(row, ['夜間']);
        districtMap[d].telecom.day   = getVal(row, ['日間']);
      }
    });

    const results = Object.values(districtMap).map(d => {
      const futurePop = d.popFuture || d.popNow; 
      const capFutTotal = d.capacityNow + d.futureCapacity;
      
      const gapNow = Math.max(0, (d.popNow * 0.1) - d.capacityNow) || 0;
      const gapFut = Math.max(0, (futurePop * 0.1) - capFutTotal) || 0;
      const dayNight = (d.telecom.night > 0 ? d.telecom.day / d.telecom.night : 1) || 1;
      
      const coverageNow = d.popNow > 0 ? d.capacityNow/d.popNow : 0;
      const coverageFuture = futurePop > 0 ? capFutTotal/futurePop : 0;

      return {
        ...d, 
        district: d.district.endsWith('區') ? d.district : d.district + '區',
        futurePop, 
        capFutureTotal: capFutTotal,
        coverageNow: isNaN(coverageNow) ? 0 : coverageNow,
        coverageFuture: isNaN(coverageFuture) ? 0 : coverageFuture,
        gapNow, gapFuture: gapFut, 
        dayNightRatio: dayNight,
        priorityScore: gapFut + (gapNow * 0.5)
      };
    }).sort((a,b) => b.priorityScore - a.priorityScore);

    const trend = [{year:'113(基期)', capacity: cityCapNow}];
    let cum = cityCapNow;
    for(let y=114; y<=118; y++) { 
      cum += (futureByYear[y]||0); 
      trend.push({year:`${y}年`, capacity: cum}); 
    }

    const cityPopFuture = Object.values(districtMap).reduce((a,b)=>a+b.popFuture, 0);
    const cityCapTotalFuture = cityCapNow + cityCapFut;
    const cityCoverageFuture = cityPopFuture > 0 ? cityCapTotalFuture / cityPopFuture : 0;

    return { 
      districtSummary: results, 
      cityStats: { 
        coverageNow: totalPopNow > 0 ? cityCapNow/totalPopNow : 0, 
        coverageFuture: isNaN(cityCoverageFuture) ? 0 : cityCoverageFuture,
        capNow: cityCapNow, 
        capFuture: cityCapTotalFuture,
        popNow: totalPopNow,
        popFuture: cityPopFuture
      }, 
      cumulativeTrend: trend 
    };
  }, [popData, childcareNowData, childcareFutureData, telecomData, popFutureTotal]);

  const chartData = useMemo(
    () => [...districtSummary].sort((a,b) => a.district.localeCompare(b.district)),
    [districtSummary]
  );

  const housingPieData = useMemo(() => {
    return [
      {name: '銀髮族服務', value: 30, color: '#F97316'},
      {name: '身心障礙者服務', value: 25, color: '#14B8A6'},
      {name: '兒童與少年服務', value: 15, color: '#EC4899'},
      {name: '嬰幼兒照顧服務', value: 10, color: '#8B5CF6'},
      {name: '婦女服務', value: 5, color: '#3B82F6'},
      {name: '貧困危機家庭服務', value: 5, color: '#EAB308'},
      {name: '社區服務、NPO培力', value: 5, color: '#F97316'},
      {name: '保護性服務', value: 5, color: '#10B981'},
    ]; 
  }, []);

  const housingTimeline = useMemo(() => {
    return [
      {
        year: '107年',
        bases: [
          { 
            baseName: '松山區健康社會住宅', 
            facilities: [
              {name:'臺北市松山區長期照顧服務機構', status:'已開辦'}, 
              {name:'臺北市松山老人服務中心', status:'已開辦'}
            ] 
          },
          { 
            baseName: '文山區興隆D2區社會住宅', 
            facilities: [
              {name:'臺北市興隆老人日間照顧中心', status:'已開辦'}, 
              {name:'文山工坊', status:'已開辦'}
            ] 
          }
        ]
      },
      {
        year: '108年',
        bases: [
          { 
            baseName: '萬華區青年社會住宅1區', 
            facilities: [
              {name:'臺北市青年托嬰中心', status:'已開辦'}
            ] 
          }
        ]
      }
    ];
  }, []);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* 1. PM Search */}
      <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-8 bg-blue-500 rounded-full"></div>
          <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">
            新建工程基地大樓 PM 查詢
          </h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="relative" ref={dropdownRef}>
            <label className="block text-sm font-medium text-slate-600 mb-2">
              搜尋基地名稱
            </label>
            <div className="relative group">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500"
                size={20}
              />
              <input
                type="text"
                placeholder="請輸入關鍵字..."
                className="w-full pl-12 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                value={pmSearchTerm}
                onChange={(e) => {
                  setPmSearchTerm(e.target.value);
                  setIsDropdownOpen(true);
                  setSelectedBase(null);
                }}
                onFocus={() => setIsDropdownOpen(true)}
              />
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors"
                onClick={toggleDropdown}
              >
                <ChevronDown
                  size={20}
                  className={`transition-transform duration-200 ${
                    isDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>
            {isDropdownOpen && filteredBases.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl max-h-60 overflow-y-auto z-50 animate-in slide-in-from-top-2 duration-200">
                {filteredBases.map((item, idx) => (
                  <div
                    key={idx}
                    className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-slate-700 border-b border-slate-50 last:border-0 transition-colors"
                    onClick={() => {
                      setPmSearchTerm(item.baseName);
                      setSelectedBase(item);
                      setIsDropdownOpen(false);
                    }}
                  >
                    {item.baseName}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-6 border border-blue-100 min-h-[120px] flex items-center justify-between shadow-sm">
            <div>
              <p className="text-sm text-slate-500 font-medium mb-1">
                對應 PM (專案負責人)
              </p>
              <div className="text-2xl font-bold text-slate-800 tracking-tight">
                {selectedBase ? selectedBase.pmName : '--'}
              </div>
            </div>
            <div className="bg-white p-4 rounded-full shadow-sm text-blue-500 border border-blue-50">
              <User size={32} />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Stats Cards */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-8 bg-orange-500 rounded-full"></div>
          <h2 className="text-xl font-bold text-slate-700">
            委外服務設施現況與趨勢
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {title:'已開辦總家數',val:stats.total,sub:'含委營/勞務',c:'orange'},
            {title:'公辦民營(勞務)',val:stats.labor,sub:'現有營運',c:'teal'},
            {title:'公辦民營(委營)',val:stats.commission,sub:'現有營運',c:'blue'},
            {title:'方案委託',val:stats.program,sub:'現有營運',c:'rose'}
          ].map((s,i)=>(
            <div
              key={i}
              className={`bg-white p-6 rounded-2xl shadow-sm border border-${s.c}-100 flex items-center gap-4 hover:shadow-md transition-shadow duration-300`}
            >
              <div className={`w-14 h-14 rounded-2xl bg-${s.c}-50 flex items-center justify-center text-${s.c}-500 shadow-sm border border-${s.c}-100`}>
                <FileText size={28}/>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1 font-medium">{s.title}</p>
                <h3 className="text-3xl font-black text-slate-800">{s.val}</h3>
                <p className="text-[10px] text-slate-400 mt-1 bg-slate-50 px-2 py-0.5 rounded-full inline-block">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Trend Chart */}
      <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-8 bg-amber-500 rounded-full"></div>
          <h2 className="text-xl font-bold text-slate-700">
            110-123年 委外設施數量成長趨勢
          </h2>
        </div>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis
                dataKey="year"
                axisLine={false}
                tickLine={false}
                tick={{fill: '#94a3b8', fontSize: 12}}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{fill: '#94a3b8', fontSize: 12}}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              />
              <Legend verticalAlign="bottom" height={36} iconType="circle" />
              <Line
                type="monotone"
                dataKey="cumulative"
                name="累計開辦數"
                stroke="#F97316"
                strokeWidth={3}
                dot={{ r: 4, fill: '#F97316', strokeWidth: 2, stroke: '#fff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 4. Social Housing Welfare Section */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-8 bg-teal-500 rounded-full"></div>
          <h2 className="text-xl font-bold text-slate-700">
            社宅參建 | 福利設施開箱
          </h2>
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[500px]">
            <h3 className="text-lg font-medium text-slate-600 mb-8">
              服務對象佔比 (社宅參建)
            </h3>
            <div className="relative w-full h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={housingPieData}
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {housingPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-300">
                <Home size={48} strokeWidth={1.5} />
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-6 max-w-xs text-xs text-slate-500">
              {housingPieData.map((entry, index) => (
                <div key={index} className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: entry.color }}
                  ></div>
                  <span>{entry.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="col-span-12 lg:col-span-8 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[500px]">
            <h3 className="text-lg font-medium text-slate-600 mb-6">歷年開辦清單</h3>
            <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {housingTimeline.map((yearGroup, idx) => (
                <div key={idx} className="relative pl-6 border-l-2 border-teal-100 mb-8 last:mb-0">
                  <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-teal-500 border-4 border-white shadow-sm"></div>
                  <h4 className="text-xl font-bold text-teal-600 mb-4 -mt-1 sticky top-0 bg-white z-10 py-1">
                    {yearGroup.year}
                  </h4>
                  <div className="space-y-4">
                    {yearGroup.bases.map((base, i) => (
                      <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <h5 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                          <Building2 size={16} className="text-slate-400"/> {base.baseName}
                        </h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {base.facilities.map((fac, j) => (
                            <div
                              key={j}
                              className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-100 text-sm"
                            >
                              <span className="text-slate-600 truncate mr-2">
                                {fac.name}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap bg-emerald-100 text-emerald-700">
                                {fac.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. Childcare Analysis */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1.5 h-8 bg-rose-500 rounded-full"></div>
          <h2 className="text-xl font-bold text-slate-700">
            公托覆蓋率與缺口分析
          </h2>
        </div>
        
        <div className="grid grid-cols-12 gap-6 mb-6">
          <div className="col-span-12 lg:col-span-8 bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold text-slate-700 mb-6 flex items-center gap-2">
              <TrendingUp className="text-orange-500"/> 114-118年 公托累計收托量成長趨勢
            </h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer>
                <AreaChart data={cumulativeTrend} margin={{top:20,right:30,left:0,bottom:0}}>
                  <defs>
                    <linearGradient id="colorCap" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F97316" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="year"
                    tick={{fill:'#94a3b8'}}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={['dataMin - 100', 'auto']}
                    tick={{fill:'#94a3b8'}}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius:'12px',
                      border:'none',
                      boxShadow:'0 4px 20px rgba(0,0,0,0.08)'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="capacity"
                    stroke="#F97316"
                    strokeWidth={3}
                    fill="url(#colorCap)"
                  >
                    <LabelList
                      dataKey="capacity"
                      position="top"
                      fill="#F97316"
                      fontSize={12}
                      offset={10}
                    />
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col justify-center items-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-400 to-teal-400"></div>
            <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
            <div className="mb-4 p-5 bg-blue-50 rounded-2xl text-blue-500 shadow-sm border border-blue-100 relative z-10">
              <Baby size={36} />
            </div>
            <h4 className="text-slate-500 font-medium mb-1 relative z-10">
              臺北市整體公托覆蓋率 (現況)
            </h4>
            <div className="text-6xl font-black text-slate-800 mb-5 tracking-tight relative z-10">
              {(cityStats.coverageNow ? cityStats.coverageNow * 100 : 0).toFixed(1)}
              <span className="text-3xl text-slate-400 ml-1">%</span>
            </div>
            <div className="text-sm text-slate-500 bg-slate-50 px-5 py-2.5 rounded-xl text-center border border-slate-100 relative z-10">
              <p className="font-semibold">
                現有收托 <span className="text-slate-800">
                  {cityStats.capNow.toLocaleString()}
                </span> 人
              </p>
              <p className="text-xs mt-1 text-slate-400">
                0-1歲人口 {cityStats.popNow.toLocaleString()} 人
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[500px]">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-700">
                  各行政區公托覆蓋率
                </h3>
                <div className="text-sm text-slate-500 mt-2 space-y-1">
                  <p className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    現況：以114年11月各區0-1歲幼兒人口為分母計算
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-400"></span>
                    布建後：以目標年度(118年)推估之各區0–1歲幼兒人口為分母
                  </p>
                </div>
              </div>
            </div>
            <div className="h-[400px] w-full">
              <ResponsiveContainer>
                <ComposedChart data={chartData} margin={{top:20,right:20,bottom:20,left:10}} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                  <XAxis 
                    dataKey="district" 
                    tick={{fill:'#64748b', fontSize:12, angle: -30, textAnchor: 'end'}} 
                    interval={0}
                    tickMargin={12}
                    axisLine={false} 
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v)=>`${(v*100).toFixed(0)}%`}
                    tick={{fill:'#64748b', fontSize:12}}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-100 text-sm w-64">
                            <p className="font-bold text-slate-800 mb-2 text-lg">{label}</p>
                            <div className="space-y-3">
                              <div>
                                <div className="flex justify-between text-xs text-slate-500 mb-1">
                                  <span>現況 (vs 0-1歲人口)</span>
                                  <span>{data.popNow}人</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-blue-500 font-medium">容量 {data.capacityNow}</span>
                                  <span className="font-bold text-blue-600">
                                    {(data.coverageNow * 100).toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                              <hr className="border-slate-100" />
                              <div>
                                <div className="flex justify-between text-xs text-slate-500 mb-1">
                                  <span>布建後 (118年推估)</span>
                                  <span>{data.futurePop}人</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-teal-500 font-medium">
                                    總容量 {data.capFutureTotal}
                                  </span>
                                  <span className="font-bold text-teal-600">
                                    {(data.coverageFuture * 100).toFixed(1)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="coverageNow" name="現況" fill="#60A5FA" barSize={16} radius={[4,4,0,0]}/>
                  <Bar dataKey="coverageFuture" name="布建後" fill="#2DD4BF" barSize={16} radius={[4,4,0,0]}/>
                  <ReferenceLine
                    y={0.10}
                    stroke="#EF4444"
                    strokeDasharray="3 3"
                    label={{
                      position:'insideTopRight',
                      value:'目標 10%',
                      fill:'#EF4444',
                      fontSize:12,
                      fontWeight:'bold'
                    }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <Info size={14}/>
              <span>人口資料來源：民政局</span>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[500px] flex flex-col">
            <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2 mb-6">
              <AlertTriangle className="text-rose-500"/> 優先改善行政區
            </h3>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
              {districtSummary.slice(0,6).map((dist, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl border border-slate-100 hover:shadow-md transition-all duration-300 bg-slate-50/50 hover:bg-white group"
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="flex items-center gap-3 font-bold text-slate-700">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx<3 ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-600'
                      }`}>{idx+1}</span>
                      {dist.district}
                    </span>
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
                      dist.coverageFuture<0.05 ? 'bg-rose-100 text-rose-600':'bg-orange-100 text-orange-600'
                    }`}>
                      {dist.coverageFuture<0.05 ? '嚴重不足':'未達標'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-4 bg-white px-3 py-1.5 rounded-lg border border-slate-100 w-fit shadow-sm">
                    <Smartphone size={14} className="text-slate-400"/>
                    <span className="text-xs text-slate-500 font-medium">
                      日夜比: {(dist.dayNightRatio || 0).toFixed(2)}
                    </span>
                    {dist.dayNightRatio>=1.2 ? (
                      <span className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200 text-xs text-amber-600 font-bold">
                        <Sun size={14}/>通勤熱區
                      </span>
                    ) : dist.dayNightRatio<0.9 ? (
                      <span className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200 text-xs text-indigo-600 font-bold">
                        <Moon size={14}/>住宅型
                      </span>
                    ) : null}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-2 mt-3 border-t border-slate-100/50 pt-3">
                    <div>
                      <p className="text-[10px] text-slate-400">現況覆蓋率</p>
                      <p className="text-lg font-bold text-blue-500">
                        {((dist.coverageNow || 0) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-400">布建後覆蓋率</p>
                      <div className="flex items-center justify-end gap-1">
                        <p className="text-lg font-bold text-teal-500">
                          {((dist.coverageFuture || 0) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-2 flex justify-between items-center text-xs border border-slate-100">
                    <span className="text-slate-500">缺口人數</span>
                    <div className="flex items-center gap-2 font-medium">
                      <span className="text-rose-400">{Math.round(dist.gapNow || 0)}</span>
                      <TrendingUp size={12} className="text-slate-300 rotate-90"/>
                      <span className={dist.gapFuture > 0 ? "text-orange-500" : "text-slate-400"}>
                        {Math.round(dist.gapFuture || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 text-center">
                * 日夜比依內政部112年電信信令人口統計計算
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

// ==========================================
// 子元件：社宅弱勢 (HousingDashboard)
// ==========================================
const HousingDashboard = () => {
  const [data, setData] = useState([]);           // 解析後的 record
  const [filteredData, setFilteredData] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [showFilter, setShowFilter] = useState(false);
  const [loading, setLoading] = useState(true);

  const HOUSING_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTT-_7yLlXfL46QQFLCIwHKEEcBvBuWNiFAsz5KiyLgAuyI7Ur-UFuf_fC5-uzMSfsivZZ1m_ySEDZe/pub?gid=1272555717&single=true&output=csv";

  // 讀取 CSV
  useEffect(() => {
    const fetchHousingData = async () => {
      try {
        setLoading(true);
        const res = await fetch(HOUSING_CSV_URL);
        const text = await res.text();

        // 直接用原始 CSV 解析，避免欄位名稱對不起來
        const { headers, rows } = parseCsvRaw(text);

        // 依「欄位名稱 + 欄位字母」雙保險找 index
        const idxSocName = findIndexByKeyword(headers, ["社宅名稱"], null);
        const idxEld = findIndexByKeyword(headers, ["獨老", "列冊獨老"], "M"); // M 欄
        const idxDisFlag = findIndexByKeyword(
          headers,
          ["是否有身障資格", "身心障礙", "身障"],
          "H" // H 欄
        );
        const idxLowType = findIndexByKeyword(
          headers,
          ["低收或中低收資格", "低收入", "中低收入"],
          "L" // L 欄
        );
        const idxHh = findIndexByKeyword(headers, ["戶號編碼", "戶號"], "Z"); // Z 欄
        const idxDisType = findIndexByKeyword(headers, ["障礙類別"], "J");     // J 欄

        // 把每列轉成我們好用的物件
        const records = rows.map((row) => ({
          project: (row[idxSocName] || "").trim(),  // 社宅名稱
          eldFlag: row[idxEld] || "",               // M 欄 列冊獨老
          disFlag: row[idxDisFlag] || "",           // H 欄 是否有身障資格
          lowType: row[idxLowType] || "",           // L 欄 低收或中低收資格
          hh: (row[idxHh] || "").trim(),            // Z 欄 戶號編碼
          disType: row[idxDisType] || "",           // J 欄 障礙類別
        }));

        setData(records);
        setFilteredData(records);

        // 初始全部社宅都勾選
        const projects = [
          ...new Set(records.map((r) => r.project).filter((n) => n)),
        ].sort();
        setSelectedProjects(projects);
      } catch (e) {
        console.error("Housing CSV 載入失敗：", e);
        setData([]);
        setFilteredData([]);
        setSelectedProjects([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHousingData();
  }, []);

  // 依社宅名稱過濾
  useEffect(() => {
    if (!data.length) {
      setFilteredData([]);
      return;
    }
    if (!selectedProjects.length) {
      setFilteredData(data);
      return;
    }

    const filtered = data.filter((r) =>
      selectedProjects.includes(r.project)
    );
    setFilteredData(filtered);
  }, [data, selectedProjects]);

  const toggleProject = (p) => {
    setSelectedProjects((prev) =>
      prev.includes(p) ? prev.filter((i) => i !== p) : [...prev, p]
    );
  };

  // 統計邏輯
  const stats = useMemo(() => {
    let eldPeople = 0,
      disPeople = 0,
      lowPeople = 0,
      midLowPeople = 0;

    // 用於計算戶數的 Set
    const eldHouseSet = new Set();
    const disHouseSet = new Set();
    const lowHouseSet = new Set();
    const midLowHouseSet = new Set();

    // 類別統計 Map
    const lowIncomeMap = { "0類": 0, "1類": 0, "2類": 0, "3類": 0, "4類": 0 }; // 戶數
    const disTypeMap = {}; // 人數

    filteredData.forEach((r) => {
      const hh = (r.hh || "").trim();

      // 1. 列冊獨老 (M欄值為 "是")
      const eldVal = (r.eldFlag || "").trim();
      const isEld = eldVal.includes("是");
      if (isEld) {
        eldPeople++;
        if (hh) eldHouseSet.add(hh);
      }

      // 2. 身心障礙 (H欄 "V")
      const disVal = (r.disFlag || "").trim();
      const isDis = /v/i.test(disVal); // 放寬：只要含 V/v
      if (isDis) {
        disPeople++;
        if (hh) disHouseSet.add(hh);

        // 6. 身心障礙類別統計：依人數
        const dType = (r.disType || "").trim();
        if (dType) {
          disTypeMap[dType] = (disTypeMap[dType] || 0) + 1;
        }
      }

      // 3 & 4. 低收 / 中低收 (L 欄)
      const lowType = (r.lowType || "").trim();

      // 低收入戶：0類~4類 (人數＋戶數)
      const isLow = ["0類", "1類", "2類", "3類", "4類"].some((t) =>
        lowType.includes(t)
      );
      if (isLow) {
        lowPeople++;
        if (hh) lowHouseSet.add(hh);
      }

      // 中低收入戶 (人數＋戶數)
      if (lowType.includes("中低收")) {
        midLowPeople++;
        if (hh) midLowHouseSet.add(hh);
      }
    });

    // 重新計算 低收入戶「戶」的類別結構
    const houseLowTypeMap = {}; // hh -> 類別（0~4類）

    filteredData.forEach((r) => {
      const hh = (r.hh || "").trim();
      const lowType = (r.lowType || "").trim();
      if (!hh) return;

      if (["0類", "1類", "2類", "3類", "4類"].some((t) => lowType.includes(t))) {
        const match = lowType.match(/[0-4]類/);
        if (match) {
          houseLowTypeMap[hh] = match[0];
        }
      }
    });

    Object.values(houseLowTypeMap).forEach((type) => {
      if (lowIncomeMap[type] !== undefined) lowIncomeMap[type]++;
    });

    return {
      eld: { people: eldPeople, house: eldHouseSet.size },
      dis: { people: disPeople, house: disHouseSet.size },
      low: { people: lowPeople, house: lowHouseSet.size },
      midLow: { people: midLowPeople, house: midLowHouseSet.size },
      lowIncomeStructure: lowIncomeMap,
      disTypeStats: disTypeMap,
    };
  }, [filteredData]);

  // 圖表資料
  const lowIncomeChartData = Object.entries(stats.lowIncomeStructure).map(
    ([name, value]) => ({
      name,
      value,
      percent:
        stats.low.house > 0
          ? ((value / stats.low.house) * 100).toFixed(1)
          : 0,
    })
  );

  const disTypeChartData = Object.entries(stats.disTypeStats)
    .map(([name, value]) => ({
      name,
      value,
      percent:
        stats.dis.people > 0
          ? ((value / stats.dis.people) * 100).toFixed(1)
          : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // UI
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* 標題與篩選列 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 mb-1">
            社宅弱勢數據分析
          </h2>
          <div className="text-sm text-slate-500">
            資料來源：Google Sheet CSV |{" "}
            {new Date().toLocaleDateString("zh-TW")}
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowFilter((p) => !p)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 hover:border-indigo-300 transition-colors"
          >
            <Filter size={16} />
            <span>
              {selectedProjects.length > 0
                ? `已選 ${selectedProjects.length} 個社宅`
                : "篩選社宅"}
            </span>
            <ChevronDown
              size={16}
              className={`transition-transform ${
                showFilter ? "rotate-180" : ""
              }`}
            />
          </button>

          {showFilter && (
            <div className="absolute right-0 mt-2 w-64 max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2">
              <div className="flex justify-between px-2 py-1 mb-1 text-xs text-slate-500">
                <button
                  onClick={() =>
                    setSelectedProjects(
                      [
                        ...new Set(
                          data.map((r) => r.project).filter((n) => n)
                        ),
                      ].sort()
                    )
                  }
                  className="hover:text-indigo-600"
                >
                  全選
                </button>
                <button
                  onClick={() => setSelectedProjects([])}
                  className="hover:text-rose-500"
                >
                  清空
                </button>
              </div>

              {[...new Set(data.map((r) => r.project).filter((n) => n))]
                .sort()
                .map((p) => (
                  <label
                    key={p}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedProjects.includes(p)}
                      onChange={() => toggleProject(p)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                    />
                    <span className="text-slate-700">{p}</span>
                  </label>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* 四大卡片區 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="列冊獨老"
          people={stats.eld.people}
          house={stats.eld.house}
          icon={<User size={24} />}
          color="orange"
        />
        <StatsCard
          title="身心障礙"
          people={stats.dis.people}
          house={stats.dis.house}
          icon={<Accessibility size={24} />}
          color="rose"
        />
        <StatsCard
          title="低收入戶"
          people={stats.low.people}
          house={stats.low.house}
          icon={<HandCoins size={24} />}
          color="indigo"
        />
        <StatsCard
          title="中低收入戶"
          people={stats.midLow.people}
          house={stats.midLow.house}
          icon={<HeartHandshake size={24} />}
          color="blue"
        />
      </div>

      {/* 圖表區 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 低收入戶類別結構 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-5 bg-indigo-500 rounded-full"></div>
            <h3 className="font-bold text-slate-700">
              低收入戶類別結構 (0–4類)
            </h3>
            <span className="text-xs text-slate-400 ml-auto">單位：戶</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={lowIncomeChartData}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#f1f5f9"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="#6366F1"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                >
                  <LabelList
                    dataKey="value"
                    position="top"
                    fill="#6366F1"
                    fontSize={12}
                  />
                  <LabelList
                    dataKey="percent"
                    position="top"
                    fill="#94a3b8"
                    fontSize={10}
                    formatter={(v) => `(${v}%)`}
                    dy={15}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 身心障礙類別統計 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-5 bg-rose-500 rounded-full"></div>
            <h3 className="font-bold text-slate-700">身心障礙類別統計</h3>
            <span className="text-xs text-slate-400 ml-auto">單位：人</span>
          </div>
          <div className="h-80 overflow-y-auto custom-scrollbar pr-2">
            <ResponsiveContainer
              width="100%"
              height={Math.max(300, disTypeChartData.length * 40)}
            >
              <BarChart
                data={disTypeChartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#f1f5f9"
                />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={80}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: "#f8fafc" }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="#F43F5E"
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                >
                  <LabelList
                    dataKey="value"
                    position="right"
                    fill="#F43F5E"
                    fontSize={12}
                  />
                  <LabelList
                    dataKey="percent"
                    position="right"
                    fill="#94a3b8"
                    fontSize={10}
                    formatter={(v) => `(${v}%)`}
                    dx={30}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};


// 共用：弱勢統計卡片
const StatsCard = ({ title, people, house, icon, color }) => (
  <div className={`bg-white p-6 rounded-2xl border-l-4 border-${color}-500 shadow-sm`}>
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-sm font-bold text-slate-500 mb-1">{title}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-slate-800">
            {people.toLocaleString()}
          </span>
          <span className="text-xs text-slate-400">人</span>
        </div>
      </div>
      <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-500`}>
        {icon}
      </div>
    </div>
    <div className="pt-3 border-t border-slate-50 flex justify-between items-center">
      <span className="text-xs text-slate-400">對應戶數</span>
      <span className={`text-sm font-bold text-${color}-600`}>
        {house.toLocaleString()} 戶
      </span>
    </div>
  </div>
);

// ==========================================
// 主應用程式 (Layout & Routing)
// ==========================================
const App = () => {
  const [activeTab, setActiveTab] = useState('welfare'); // welfare | housing
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col md:flex-row">
      
      {/* Sidebar (Left Navigation) */}
      <aside className="w-full md:w-72 bg-white border-r border-slate-200 flex-shrink-0 md:h-screen sticky top-0 z-50 flex flex-col">
        {/* Logo Area */}
        <div className="h-24 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {/* 目前仍用「綜」字方塊，如要改為 logo 可引用 LOGO_URL */}
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200">
              綜
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-black text-slate-800 leading-tight">
                綜合規劃股
              </h1>
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                Dashboard
              </span>
            </div>
          </div>
          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden ml-auto text-slate-400"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X/> : <Menu/>}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className={`flex-1 p-6 space-y-2 ${mobileMenuOpen ? 'block' : 'hidden md:block'}`}>
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">
            Main Menu
          </div>
          
          <button 
            onClick={() => {setActiveTab('welfare'); setMobileMenuOpen(false);}}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${
              activeTab === 'welfare'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Layout
              size={20}
              className={activeTab==='welfare' ? 'text-indigo-200' : 'text-slate-400'}
            />
            社福設施
          </button>

          <button 
            onClick={() => {setActiveTab('housing'); setMobileMenuOpen(false);}}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${
              activeTab === 'housing'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Home
              size={20}
              className={activeTab==='housing' ? 'text-indigo-200' : 'text-slate-400'}
            />
            社宅弱勢
          </button>
        </nav>

        {/* Footer Info */}
        <div className="p-6 border-t border-slate-100 hidden md:block">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="text-xs text-slate-400 leading-relaxed text-center">
              Taipei City Government<br/>
              Social Welfare Dashboard<br/>
              © 2024
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 bg-slate-50/50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-10">
          {/* Header Title */}
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                {activeTab === 'welfare'
                  ? '社福設施布建概況'
                  : '社宅弱勢戶數據分析'}
              </h2>
              <p className="text-sm text-slate-500 mt-1 font-medium">
                {activeTab === 'welfare'
                  ? '監控各區布建進度與人口覆蓋率'
                  : '分析各社宅現住戶弱勢比例與特徵'}
              </p>
            </div>
            <div className="hidden sm:block text-xs font-bold text-slate-400 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
              資料更新：{new Date().toLocaleDateString()}
            </div>
          </div>

          {/* Content Render */}
          <div className="animate-in fade-in duration-500 slide-in-from-bottom-4">
            {activeTab === 'welfare' ? <WelfareDashboard /> : <HousingDashboard />}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
