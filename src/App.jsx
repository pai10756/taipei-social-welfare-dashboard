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

// --- LOGO 設定 ---
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
  return String(name).trim().replace(/臺/g, '台').replace(/^台北市/, '').replace(/台彎省/, '').replace(/\s+/g, '').replace(/區$/, '');
};

const parseData = (text, headerKeyword = null) => {
  if (!text) return [];
  let lines = text.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) return [];
  let separator = lines[0].includes('\t') ? '\t' : ',';
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
    if (cols.length > 7) entry['raw_col_h'] = cols[7]; // H欄 Index 7
    return entry;
  });
};

// ==========================================
// 子元件：社福設施 (WelfareDashboard)
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
      } catch (error) { console.error("Error:", error); } 
      finally { setLoading(false); }
    };
    fetchData();

    const handleClickOutside = (e) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const processedData = useMemo(() => {
    if (csvData.length === 0) return [];
    const findKey = (obj, keywords) => Object.keys(obj).find(k => keywords.some(w => k.replace(/\s/g,'').includes(w)));
    const firstRow = csvData[0];
    const keys = {
        baseName: findKey(firstRow, ['基地名稱']),
        pmName: findKey(firstRow, ['PM']),
        id: findKey(firstRow, ['機構代碼']),
        type: findKey(firstRow, ['辦理類型']),
        startYear: findKey(firstRow, ['開辦年度']),
        status: findKey(firstRow, ['開辦狀態', '是否開辦']),
    };
    return csvData.map(row => ({
        baseName: row[keys.baseName] || '',
        pmName: row[keys.pmName] || '',
        id: row[keys.id],
        type: row[keys.type],
        startYear: parseInt(row[keys.startYear]) || null,
        status: (row[keys.status] || '').trim(),
    }));
  }, [csvData]);

  const baseList = useMemo(() => processedData.filter(i => i.baseName.trim() && i.pmName.trim())
    .filter((i, idx, self) => idx === self.findIndex(t => t.baseName === i.baseName)), [processedData]);
  
  const filteredBases = useMemo(() => pmSearchTerm ? baseList.filter(i => i.baseName.includes(pmSearchTerm)) : baseList, [baseList, pmSearchTerm]);

  const stats = useMemo(() => {
    if (csvData.length === 0) return { total: 0, labor: 0, commission: 0, program: 0 };
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

    const getVal = (obj, kw) => { const k = Object.keys(obj).find(k=>kw.some(w=>k.includes(w))); return k?parseNumber(obj[k]):0; };
    const getStr = (obj, kw) => { const k = Object.keys(obj).find(k=>kw.some(w=>k.includes(w))); return k?String(obj[k]).trim():''; };

    const districtMap = {};
    popData.forEach(row => {
        const rawDist = getStr(row, ['行政區', '區別']);
        if (!rawDist || rawDist.includes('總計')) return;
        const normDist = normalizeDistrict(rawDist);
        if (!normDist) return;
        const pop0 = getVal(row, ['0歲']), pop1 = getVal(row, ['1歲']);
        
        if (!districtMap[normDist]) districtMap[normDist] = { district: rawDist, popNow: 0, popFuture: 0, capacityNow: 0, futureCapacity: 0, telecom: {day:0,night:0} };
        districtMap[normDist].popNow += (pop0 + pop1);
        districtMap[normDist].popFuture += parseNumber(row['raw_col_h']); 
    });
    
    const totalPopNow = Object.values(districtMap).reduce((a,b)=>a+b.popNow,0);
    const growthRate = popFutureTotal > 0 ? popFutureTotal / totalPopNow : 0.92;
    Object.values(districtMap).forEach(d => {
        if(d.popFuture === 0) d.popFuture = Math.round(d.popNow * growthRate);
    });

    let cityCapNow = 0, cityCapFut = 0;
    childcareNowData.forEach(row => {
        const d = normalizeDistrict(getStr(row, ['行政區']));
        const cap = getVal(row, ['收托']);
        if (districtMap[d]) { districtMap[d].capacityNow += cap; cityCapNow += cap; }
    });
    const futureByYear = {};
    childcareFutureData.forEach(row => {
        const d = normalizeDistrict(getStr(row, ['行政區']));
        const cap = getVal(row, ['收托']);
        const y = parseInt(getStr(row, ['年度']).replace(/\D/g,'')) || 115;
        if (districtMap[d]) { districtMap[d].futureCapacity += cap; cityCapFut += cap; }
        if (y>=114 && y<=118) futureByYear[y] = (futureByYear[y]||0)+cap;
    });
    telecomData.forEach(row => {
        const d = normalizeDistrict(getStr(row, ['行政區']));
        if (districtMap[d]) {
            districtMap[d].telecom.night = getVal(row, ['夜間']);
            districtMap[d].telecom.day = getVal(row, ['日間']);
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
            district: d.district.endsWith('區')?d.district:d.district+'區',
            futurePop, capFutTotal,
            coverageNow: isNaN(coverageNow) ? 0 : coverageNow,
            coverageFuture: isNaN(coverageFuture) ? 0 : coverageFuture,
            gapNow, gapFut, dayNightRatio: dayNight,
            priorityScore: gapFut + (gapNow * 0.5)
        };
    }).sort((a,b) => b.priorityScore - a.priorityScore);

    const trend = [{year:'113(基期)', capacity: cityCapNow}];
    let cum = cityCapNow;
    for(let y=114; y<=118; y++) { cum += (futureByYear[y]||0); trend.push({year:`${y}年`, capacity: cum}); }

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

  const chartData = useMemo(() => [...districtSummary].sort((a,b) => a.district.localeCompare(b.district)), [districtSummary]);

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
            { baseName: '松山區健康社會住宅', facilities: [{name:'臺北市松山區長期照顧服務機構', status:'已開辦'}, {name:'臺北市松山老人服務中心', status:'已開辦'}] },
            { baseName: '文山區興隆D2區社會住宅', facilities: [{name:'臺北市興隆老人日間照顧中心', status:'已開辦'}, {name:'文山工坊', status:'已開辦'}] }
          ]
        },
        {
          year: '108年',
          bases: [
             { baseName: '萬華區青年社會住宅1區', facilities: [{name:'臺北市青年托嬰中心', status:'已開辦'}] }
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
                <h2 className="text-xl font-bold text-slate-700 flex items-center gap-2">新建工程基地大樓 PM 查詢</h2>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="relative" ref={dropdownRef}>
                    <label className="block text-sm font-medium text-slate-600 mb-2">搜尋基地名稱</label>
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500" size={20} />
                        <input type="text" placeholder="請輸入關鍵字..." className="w-full pl-12 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            value={pmSearchTerm} onChange={(e) => {setPmSearchTerm(e.target.value); setIsDropdownOpen(true); setSelectedBase(null);}} onFocus={()=>setIsDropdownOpen(true)} />
                        <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors" onClick={toggleDropdown}>
                            <ChevronDown size={20} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                    </div>
                    {isDropdownOpen && filteredBases.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl max-h-60 overflow-y-auto z-50 animate-in slide-in-from-top-2 duration-200">
                            {filteredBases.map((item, idx) => (
                                <div key={idx} className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-slate-700 border-b border-slate-50 last:border-0 transition-colors"
                                    onClick={() => { setPmSearchTerm(item.baseName); setSelectedBase(item); setIsDropdownOpen(false); }}>
                                    {item.baseName}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-6 border border-blue-100 min-h-[120px] flex items-center justify-between shadow-sm">
                    <div>
                        <p className="text-sm text-slate-500 font-medium mb-1">對應 PM (專案負責人)</p>
                        <div className="text-2xl font-bold text-slate-800 tracking-tight">{selectedBase ? selectedBase.pmName : '--'}</div>
                    </div>
                    <div className="bg-white p-4 rounded-full shadow-sm text-blue-500 border border-blue-50"><User size={32} /></div>
                </div>
             </div>
        </section>

        {/* 2. Stats Cards */}
        <section>
            <div className="flex items-center gap-3 mb-6"><div className="w-1.5 h-8 bg-orange-500 rounded-full"></div><h2 className="text-xl font-bold text-slate-700">委外服務設施現況與趨勢</h2></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[{title:'已開辦總家數',val:stats.total,sub:'含委營/勞務',c:'orange'},{title:'公辦民營(勞務)',val:stats.labor,sub:'現有營運',c:'teal'},{title:'公辦民營(委營)',val:stats.commission,sub:'現有營運',c:'blue'},{title:'方案委託',val:stats.program,sub:'現有營運',c:'rose'}].map((s,i)=>(
                    <div key={i} className={`bg-white p-6 rounded-2xl shadow-sm border border-${s.c}-100 flex items-center gap-4 hover:shadow-md transition-shadow duration-300`}>
                        <div className={`w-14 h-14 rounded-2xl bg-${s.c}-50 flex items-center justify-center text-${s.c}-500 shadow-sm border border-${s.c}-100`}><FileText size={28}/></div>
                        <div><p className="text-xs text-slate-400 mb-1 font-medium">{s.title}</p><h3 className="text-3xl font-black text-slate-800">{s.val}</h3><p className="text-[10px] text-slate-400 mt-1 bg-slate-50 px-2 py-0.5 rounded-full inline-block">{s.sub}</p></div>
                    </div>
                ))}
            </div>
        </section>

        {/* 3. Trend Chart */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
             <div className="flex items-center gap-3 mb-6"><div className="w-1.5 h-8 bg-amber-500 rounded-full"></div><h2 className="text-xl font-bold text-slate-700">110-123年 委外設施數量成長趨勢</h2></div>
             <div className="h-[350px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                     <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                     <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                     <Legend verticalAlign="bottom" height={36} iconType="circle" />
                     <Line type="monotone" dataKey="cumulative" name="累計開辦數" stroke="#F97316" strokeWidth={3} dot={{ r: 4, fill: '#F97316', strokeWidth: 2, stroke: '#fff' }} />
                   </LineChart>
                 </ResponsiveContainer>
             </div>
        </section>

        {/* 4. Social Housing */}
        <section>
          <div className="flex items-center gap-3 mb-6"><div className="w-1.5 h-8 bg-teal-500 rounded-full"></div><h2 className="text-xl font-bold text-slate-700">社宅參建 | 福利設施開箱</h2></div>
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[500px]">
              <h3 className="text-lg font-medium text-slate-600 mb-8">服務對象佔比 (社宅參建)</h3>
              <div className="relative w-full h-[300px]">
                {ResponsiveContainer && (
                  <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={housingPieData} innerRadius={80} outerRadius={120} paddingAngle={2} dataKey="value">
                      {housingPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                )}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-300"><Home size={48} strokeWidth={1.5} /></div>
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-6 max-w-xs text-xs text-slate-500">
                {housingPieData.map((entry, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }}></div>
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
                    <h4 className="text-xl font-bold text-teal-600 mb-4 -mt-1 sticky top-0 bg-white z-10 py-1">{yearGroup.year}</h4>
                    <div className="space-y-4">
                      {yearGroup.bases.map((base, i) => (
                        <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                          <h5 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                             <Building2 size={16} className="text-slate-400"/> {base.baseName}
                          </h5>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                             {base.facilities.map((fac, j) => (
                               <div key={j} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-100 text-sm">
                                  <span className="text-slate-600 truncate mr-2">{fac.name}</span>
                                  <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap bg-emerald-100 text-emerald-700">{fac.status}</span>
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
          <div className="flex items-center gap-3 mb-6"><div className="w-1.5 h-8 bg-rose-500 rounded-full"></div><h2 className="text-xl font-bold text-slate-700">公托覆蓋率與缺口分析</h2></div>
          
          <div className="grid grid-cols-12 gap-6 mb-6">
             <div className="col-span-12 lg:col-span-8 bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
               <h3 className="text-lg font-bold text-slate-700 mb-6 flex items-center gap-2"><TrendingUp className="text-orange-500"/> 114-118年 公托累計收托量成長趨勢</h3>
               <div className="h-[250px] w-full">
                 <ResponsiveContainer><AreaChart data={cumulativeTrend} margin={{top:20,right:30,left:0,bottom:0}}>
                    <defs><linearGradient id="colorCap" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F97316" stopOpacity={0.1}/><stop offset="95%" stopColor="#F97316" stopOpacity={0}/></linearGradient></defs>
                    <XAxis dataKey="year" tick={{fill:'#94a3b8'}} axisLine={false} tickLine={false}/><YAxis domain={['dataMin - 100', 'auto']} tick={{fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.08)'}}/><Area type="monotone" dataKey="capacity" stroke="#F97316" strokeWidth={3} fill="url(#colorCap)"><LabelList dataKey="capacity" position="top" fill="#F97316" fontSize={12} offset={10}/></Area>
                 </AreaChart></ResponsiveContainer>
               </div>
             </div>
             <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col justify-center items-center relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-400 to-teal-400"></div>
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-50 rounded-full opacity-50 group-hover:scale-110 transition-transform duration-500"></div>
                <div className="mb-4 p-5 bg-blue-50 rounded-2xl text-blue-500 shadow-sm border border-blue-100 relative z-10"><Baby size={36} /></div>
                <h4 className="text-slate-500 font-medium mb-1 relative z-10">臺北市整體公托覆蓋率 (現況)</h4>
                {/* [Fix] Add fallback for cityStats.coverageNow */}
                <div className="text-6xl font-black text-slate-800 mb-5 tracking-tight relative z-10">{(cityStats.coverageNow ? cityStats.coverageNow * 100 : 0).toFixed(1)}<span className="text-3xl text-slate-400 ml-1">%</span></div>
                <div className="text-sm text-slate-500 bg-slate-50 px-5 py-2.5 rounded-xl text-center border border-slate-100 relative z-10">
                   <p className="font-semibold">現有收托 <span className="text-slate-800">{cityStats.capNow.toLocaleString()}</span> 人</p>
                   <p className="text-xs mt-1 text-slate-400">0-1歲人口 {cityStats.popNow.toLocaleString()} 人</p>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[500px]">
               <div className="flex justify-between items-start mb-6">
                 <div>
                    <h3 className="text-lg font-bold text-slate-700">各行政區公托覆蓋率</h3>
                    <div className="text-sm text-slate-500 mt-2 space-y-1">
                     <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-400"></span>現況：以114年11月各區0-1歲幼兒人口為分母計算</p>
                     <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-teal-400"></span>布建後：以目標年度(118年)推估之各區0–1歲幼兒人口為分母</p>
                    </div>
                 </div>
               </div>
               <div className="h-[400px] w-full">
                 <ResponsiveContainer><ComposedChart data={chartData} margin={{top:20,right:20,bottom:20,left:10}} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                    
                    {/* [Fix] X-Axis: Force show all labels with interval=0, rotate to avoid overlap */}
                    <XAxis 
                      dataKey="district" 
                      tick={{fill:'#64748b', fontSize:12, angle: -30, textAnchor: 'end'}} 
                      interval={0}
                      tickMargin={12}
                      axisLine={false} 
                      tickLine={false}
                    />

                    <YAxis tickFormatter={(v)=>`${(v*100).toFixed(0)}%`} tick={{fill:'#64748b', fontSize:12}} axisLine={false} tickLine={false}/>
                    
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
                                    <span className="font-bold text-blue-600">{(data.coverageNow * 100).toFixed(1)}%</span>
                                  </div>
                                </div>
                                <hr className="border-slate-100" />
                                <div>
                                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                                    <span>布建後 (118年推估)</span>
                                    <span>{data.futurePop}人</span>
                                  </div>
                                  <div className="flex justify-between gap-4">
                                    <span className="text-teal-500 font-medium">總容量 {data.capacityFutureTotal}</span>
                                    <span className="font-bold text-teal-600">{(data.coverageFuture * 100).toFixed(1)}%</span>
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

                    <ReferenceLine y={0.10} stroke="#EF4444" strokeDasharray="3 3" label={{position:'insideTopRight', value:'目標 10%', fill:'#EF4444', fontSize:12, fontWeight:'bold'}}/>
                 </ComposedChart></ResponsiveContainer>
               </div>
               <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100"><Info size={14}/><span>人口資料來源：民政局</span></div>
            </div>

            <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[500px] flex flex-col">
              <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2 mb-6"><AlertTriangle className="text-rose-500"/> 優先改善行政區</h3>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                 {districtSummary.slice(0,6).map((dist, idx) => (
                    <div key={idx} className="p-4 rounded-2xl border border-slate-100 hover:shadow-md transition-all duration-300 bg-slate-50/50 hover:bg-white group">
                        <div className="flex justify-between items-center mb-3">
                            <span className="flex items-center gap-3 font-bold text-slate-700">
                                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${idx<3 ? 'bg-rose-100 text-rose-600' : 'bg-slate-200 text-slate-600'}`}>{idx+1}</span>
                                {dist.district}
                            </span>
                            <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${dist.coverageFuture<0.05?'bg-rose-100 text-rose-600':'bg-orange-100 text-orange-600'}`}>{dist.coverageFuture<0.05?'嚴重不足':'未達標'}</span>
                        </div>
                        <div className="flex items-center gap-2 mb-4 bg-white px-3 py-1.5 rounded-lg border border-slate-100 w-fit shadow-sm">
                             <Smartphone size={14} className="text-slate-400"/>
                             {/* [Fix] Add fallback for dist.dayNightRatio */}
                             <span className="text-xs text-slate-500 font-medium">日夜比: {(dist.dayNightRatio || 0).toFixed(2)}</span>
                             {dist.dayNightRatio>=1.2 ? <span className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200 text-xs text-amber-600 font-bold"><Sun size={14}/>通勤熱區</span> : dist.dayNightRatio<0.9 ? <span className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-200 text-xs text-indigo-600 font-bold"><Moon size={14}/>住宅型</span> : null}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-2 mt-3 border-t border-slate-100/50 pt-3">
                          <div>
                            <p className="text-[10px] text-slate-400">現況覆蓋率</p>
                            <p className="text-lg font-bold text-blue-500">
                              {/* [Fix] Add fallback for dist.coverageNow */}
                              {(dist.coverageNow * 100 || 0).toFixed(1)}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400">布建後覆蓋率</p>
                            <div className="flex items-center justify-end gap-1">
                              <p className="text-lg font-bold text-teal-500">
                                {/* [Fix] Add fallback for dist.coverageFuture */}
                                {(dist.coverageFuture * 100 || 0).toFixed(1)}%
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="bg-white rounded-lg p-2 flex justify-between items-center text-xs border border-slate-100">
                          <span className="text-slate-500">缺口人數</span>
                          <div className="flex items-center gap-2 font-medium">
                            {/* [Fix] Add fallback for dist.gapNow */}
                            <span className="text-rose-400">{Math.round(dist.gapNow || 0)}</span>
                            <TrendingUp size={12} className="text-slate-300 rotate-90"/>
                            <span className={dist.gapFuture > 0 ? "text-orange-500" : "text-slate-400"}>
                              {/* [Fix] Add fallback for dist.gapFuture */}
                              {Math.round(dist.gapFuture || 0)}
                            </span>
                          </div>
                        </div>
                    </div>
                 ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100"><p className="text-[10px] text-slate-400 text-center">* 日夜比依內政部112年電信信令人口統計計算</p></div>
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
  const [view, setView] = useState("overview"); // overview | comparison
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedProjects, setSelectedProjects] = useState([]);
  const [showFilter, setShowFilter] = useState(false);
  const [loading, setLoading] = useState(true);

  // 社宅弱勢 CSV（你提供的連結）
  const HOUSING_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTT-_7yLlXfL46QQFLCIwHKEEcBvBuWNiFAsz5KiyLgAuyI7Ur-UFuf_fC5-uzMSfsivZZ1m_ySEDZe/pub?gid=1272555717&single=true&output=csv";

  // 讀取 CSV
  useEffect(() => {
    const fetchHousingData = async () => {
      try {
        setLoading(true);
        const res = await fetch(HOUSING_CSV_URL);
        const text = await res.text();

        // 指定「社宅名稱」這一列是標題列，避免抓錯 header
        const rawData = parseData(text, "社宅名稱");

        // 取出所有社宅名稱
        const projects = [
          ...new Set(
            rawData
              .map((r) => (r["社宅名稱"] || "").trim())
              .filter((n) => n && n !== "社宅名稱")
          ),
        ].sort();

        setData(rawData);
        setFilteredData(rawData);
        setSelectedProjects(projects);
      } catch (e) {
        console.error("Housing CSV 載入失敗：", e);
      } finally {
        setLoading(false);
      }
    };

    fetchHousingData();
  }, []);

  // 依社宅名稱過濾
  useEffect(() => {
    if (!data.length) return;
    if (!selectedProjects.length) {
      setFilteredData(data);
      return;
    }

    const filtered = data.filter((r) =>
      selectedProjects.includes((r["社宅名稱"] || "").trim())
    );
    setFilteredData(filtered);
  }, [data, selectedProjects]);

  // 總體統計（和你前一版一樣）
  const stats = useMemo(() => {
    let eld = 0,
      dis = 0,
      low = 0;
    let ageGroups = {
      "0-18歲": 0,
      "19-64歲": 0,
      "65-74歲": 0,
      "75歲以上": 0,
    };
    let disMap = {};
    let liMap = { "0類": 0, "1類": 0, "2類": 0, "3類": 0, "4類": 0 };

    const households = new Set(filteredData.map((r) => r["戶號編碼"]));

    filteredData.forEach((r) => {
      const isEld = (r["獨老（列冊獨老）"] || "").includes("是");
      const isDis = (r["是否有身障資格"] || "").trim() !== "";
      const liType = r["低收或中低收資格"] || "";

      if (isEld) eld++;
      if (isDis) {
        dis++;
        const dType = r["障礙類別"];
        if (dType) disMap[dType] = (disMap[dType] || 0) + 1;
      }
      if (liType.includes("類")) {
        low++;
        if (liMap[liType] !== undefined) liMap[liType]++;
      }

      const age = parseInt(r["年齡"]);
      if (!isNaN(age)) {
        if (age <= 18) ageGroups["0-18歲"]++;
        else if (age <= 64) ageGroups["19-64歲"]++;
        else if (age <= 74) ageGroups["65-74歲"]++;
        else ageGroups["75歲以上"]++;
      }
    });

    return {
      pop: filteredData.length,
      house: households.size,
      eld,
      dis,
      low,
      ageGroups,
      disMap,
      liMap,
    };
  }, [filteredData]);

  // 各社宅比較：以「戶號」為單位算比例
  const projectStats = useMemo(() => {
    const projectMap = {};

    filteredData.forEach((r) => {
      const projectName = (r["社宅名稱"] || "未標註").trim();
      const hh = (r["戶號編碼"] || "").trim() || `${projectName}-未知戶`;

      if (!projectMap[projectName]) {
        projectMap[projectName] = {
          total: new Set(),
          eld: new Set(),
          dis: new Set(),
        };
      }

      const p = projectMap[projectName];
      p.total.add(hh);

      const isEld = (r["獨老（列冊獨老）"] || "").includes("是");
      const isDis = (r["是否有身障資格"] || "").trim() !== "";

      if (isEld) p.eld.add(hh);
      if (isDis) p.dis.add(hh);
    });

    return Object.entries(projectMap).map(([name, p]) => {
      const total = Math.max(p.total.size, 1);
      return {
        name,
        total,
        eldCount: p.eld.size,
        disCount: p.dis.size,
        eldRate: p.eld.size / total,
        disRate: p.dis.size / total,
      };
    });
  }, [filteredData]);

  const toggleProject = (p) => {
    setSelectedProjects((prev) =>
      prev.includes(p) ? prev.filter((i) => i !== p) : [...prev, p]
    );
  };

  const liChartData = Object.keys(stats.liMap).map((k) => ({
    name: k,
    value: stats.liMap[k],
  }));
  const disChartData = Object.keys(stats.disMap)
    .map((k) => ({ name: k, value: stats.disMap[k] }))
    .sort((a, b) => b.value - a.value);
  const ageChartData = Object.keys(stats.ageGroups).map((k) => ({
    name: k,
    value: stats.ageGroups[k],
  }));

  if (loading)
    return (
      <div className="h-96 flex items-center justify-center text-slate-400">
        <Loader2 className="animate-spin mr-2" /> 載入社宅數據中...
      </div>
    );

  // 依獨老 / 身障比例排序，取前 10 名
  const topEldProjects = [...projectStats]
    .filter((p) => p.total >= 5) // 避免樣本太少
    .sort((a, b) => b.eldRate - a.eldRate)
    .slice(0, 10);

  const topDisProjects = [...projectStats]
    .filter((p) => p.total >= 5)
    .sort((a, b) => b.disRate - a.disRate)
    .slice(0, 10);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* 上方控制列：標題 + tab + 篩選 */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 mb-1">
              社宅弱勢數據分析
            </h2>
            {/* 這邊保留一次資料來源文字，篩選框裡就不要再重複 */}
            <div className="text-sm text-slate-500 mb-4">
              資料來源：Google Sheet CSV |{" "}
              {new Date().toLocaleDateString("zh-TW")}
            </div>
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-xl w-fit">
              <button
                onClick={() => setView("overview")}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  view === "overview"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                總體分析
              </button>
              <button
                onClick={() => setView("comparison")}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  view === "comparison"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                各社比較
              </button>
            </div>
          </div>

          {/* 社宅篩選器（已移除重複的標題/資料來源文字） */}
          <div className="w-full lg:w-auto">
            <button
              onClick={() => setShowFilter((p) => !p)}
              className="flex items-center justify-between w-full lg:w-64 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 hover:border-indigo-300 hover:text-indigo-600 bg-slate-50"
            >
              <span className="flex items-center gap-2">
                <Filter size={16} />
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
              <div className="mt-2 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl p-3 shadow-lg text-xs space-y-1">
                {Array.from(
                  new Set(
                    data
                      .map((r) => (r["社宅名稱"] || "").trim())
                      .filter((n) => n)
                  )
                )
                  .sort()
                  .map((name) => (
                    <label
                      key={name}
                      className="flex items-center gap-2 py-0.5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={selectedProjects.includes(name)}
                        onChange={() => toggleProject(name)}
                      />
                      <span className="text-slate-600">{name}</span>
                    </label>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 內容區：依 tab 切換 */}
      {view === "overview" ? (
        // ======= 總體分析頁（保留你原本的設計） =======
        <div className="grid grid-cols-12 gap-6">
          {/* 左邊統計卡片區 */}
          <div className="col-span-12 lg:col-span-4 space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Users size={16} className="text-indigo-500" />
                弱勢戶概況
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400">總人口數</p>
                  <p className="text-lg font-bold text-slate-800">
                    {stats.pop.toLocaleString()} 人
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">總戶數</p>
                  <p className="text-lg font-bold text-slate-800">
                    {stats.house.toLocaleString()} 戶
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">列冊獨老</p>
                  <p className="text-lg font-bold text-amber-600">
                    {stats.eld.toLocaleString()} 戶
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">身心障礙</p>
                  <p className="text-lg font-bold text-rose-500">
                    {stats.dis.toLocaleString()} 戶
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">低收 / 中低收</p>
                  <p className="text-lg font-bold text-sky-500">
                    {stats.low.toLocaleString()} 戶
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <BarChart2 size={16} className="text-teal-500" />
                年齡結構
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ageChartData} margin={{ top: 10, left: 0 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "none",
                        boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 右邊圖表區：低收類別 + 障礙類別 */}
          <div className="col-span-12 lg:col-span-8 space-y-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">
                低收 / 中低收 類別分布
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={liChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "none",
                        boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">
                身心障礙 類別分布（全體）
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={disChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#94a3b8", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "none",
                        boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // ======= 各社比較頁：列冊獨老 / 身障比例排行 =======
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-6 bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <AlertCircle size={16} className="text-amber-500" />
              各社宅「列冊獨老」比例排行
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topEldProjects}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 80, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    width={80}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                  />
                  <Tooltip
                    formatter={(v, k, p) => [
                      `${(v * 100).toFixed(1)}%`,
                      "列冊獨老占比",
                    ]}
                    labelFormatter={(label, payload) =>
                      `${label}（${payload?.[0]?.payload.eldCount} 戶 / ${
                        payload?.[0]?.payload.total
                      } 戶）`
                    }
                    contentStyle={{
                      borderRadius: 12,
                      border: "none",
                      boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
                    }}
                  />
                  <Bar dataKey="eldRate" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-6 bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-500" />
              各社宅「身心障礙」比例排行
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topDisProjects}
                  layout="vertical"
                  margin={{ top: 10, right: 20, left: 80, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    width={80}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                  />
                  <Tooltip
                    formatter={(v, k, p) => [
                      `${(v * 100).toFixed(1)}%`,
                      "身心障礙占比",
                    ]}
                    labelFormatter={(label, payload) =>
                      `${label}（${payload?.[0]?.payload.disCount} 戶 / ${
                        payload?.[0]?.payload.total
                      } 戶）`
                    }
                    contentStyle={{
                      borderRadius: 12,
                      border: "none",
                      boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
                    }}
                  />
                  <Bar dataKey="disRate" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const KPICard = ({title, val, total, icon, color}) => (
    <div className={`bg-white p-6 rounded-2xl border-l-4 border-${color}-500 shadow-sm hover:-translate-y-1 transition-transform duration-300`}>
        <div className="flex justify-between items-center mb-4">
            <p className="text-sm font-bold text-slate-500">{title}</p>
            <div className={`w-10 h-10 rounded-xl bg-${color}-50 flex items-center justify-center text-${color}-500`}>{icon}</div>
        </div>
        <div className="text-3xl font-black text-slate-800">{val.toLocaleString()} <span className="text-sm font-medium text-slate-400">人</span></div>
        <div className={`mt-3 inline-flex px-2.5 py-1 rounded-lg text-xs font-bold bg-${color}-50 text-${color}-600`}>
            {/* [Fix] Add fallback for val/total to prevent NaN */}
            佔總戶數 {total > 0 ? (val / total * 100).toFixed(1) : 0}%
        </div>
    </div>
);

const ChartCard = ({title, color, children}) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className={`flex items-center mb-6 pl-3 border-l-4 border-${color}-500`}>
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        </div>
        {children}
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
                 <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200">綜</div>
                 <div className="flex flex-col">
                    <h1 className="text-2xl font-black text-slate-800 leading-tight">綜合規劃股</h1>
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Dashboard</span>
                 </div>
             </div>
             {/* Mobile Menu Toggle */}
             <button className="md:hidden ml-auto text-slate-400" onClick={()=>setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X/> : <Menu/>}
             </button>
          </div>

          {/* Navigation Links */}
          <nav className={`flex-1 p-6 space-y-2 ${mobileMenuOpen ? 'block' : 'hidden md:block'}`}>
             <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">Main Menu</div>
             
             <button 
                onClick={() => {setActiveTab('welfare'); setMobileMenuOpen(false);}}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === 'welfare' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
             >
                <Layout size={20} className={activeTab==='welfare'?'text-indigo-200':'text-slate-400'}/> 社福設施
             </button>

             <button 
                onClick={() => {setActiveTab('housing'); setMobileMenuOpen(false);}}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${activeTab === 'housing' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
             >
                <Home size={20} className={activeTab==='housing'?'text-indigo-200':'text-slate-400'}/> 社宅弱勢
             </button>
          </nav>

          {/* Footer Info */}
          <div className="p-6 border-t border-slate-100 hidden md:block">
             <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-xs text-slate-400 leading-relaxed text-center">
                   Taipei City Government<br/>Social Welfare Dashboard<br/>© 2024
                </p>
             </div>
          </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 bg-slate-50/50">
         <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-10">
            {/* Header Title (Mobile only or Breadcrumb style) */}
            <div className="mb-8 flex items-end justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                        {activeTab === 'welfare' ? '社福設施布建概況' : '社宅弱勢戶數據分析'}
                    </h2>
                    <p className="text-sm text-slate-500 mt-1 font-medium">
                        {activeTab === 'welfare' ? '監控各區布建進度與人口覆蓋率' : '分析各社宅現住戶弱勢比例與特徵'}
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
