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
            'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=1794601700&single=true&output=csv',
        ];
        const responses = await Promise.all(urls.map(url => fetch(url)));
        const texts = await Promise.all(responses.map(res => res.text()));
        const [csvText, popText, childcareNowText, childcareFutureText, telecomText, futurePopText] = texts;
        
        const parsedCsv = parseData(csvText, '行政區');
        const parsedPop = parsePopulationData(popText);
        const parsedChildNow = parseData(childcareNowText, '行政區');
        const parsedChildFuture = parseData(childcareFutureText, '行政區');
        const parsedTelecom = parseData(telecomText, '行政區');
        const futurePop = parseData(futurePopText, '行政區');

        setCsvData(parsedCsv);
        setPopData(parsedPop);
        setChildcareNowData(parsedChildNow);
        setChildcareFutureData(parsedChildFuture);
        setTelecomData(parsedTelecom);

        const futurePopTotalVal = futurePop.reduce((sum, row) => {
            const val = parseNumber(row['0-1歲人口_118年(推估)']);
            return sum + (isNaN(val) ? 0 : val);
        }, 0);
        setPopFutureTotal(futurePopTotalVal);

      } catch (error) {
        console.error('Error fetching CSV data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const stats = useMemo(() => {
    if (!csvData.length) return { total: 0, labor: 0, entrust: 0, participated: 0 };
    const total = csvData.length;
    const labor = csvData.filter(row => row['類型'] === '公辦民營(勞務)').length;
    const entrust = csvData.filter(row => row['類型'] === '公辦民營(委營)').length;
    const participated = csvData.filter(row => row['類型'] === '方案委託(帶地投標)').length;
    return { total, labor, entrust, participated };
  }, [csvData]);

  const districtSummary = useMemo(() => {
    if (!popData.length || !childcareNowData.length || !childcareFutureData.length || !telecomData.length) {
      return [];
    }

    const popMap = {};
    popData.forEach(row => {
      const rawDistrict = row['行政區'] || row['區域'] || '';
      const district = normalizeDistrict(rawDistrict);
      popMap[district] = {
        pop0_1: parseNumber(row['0-1歲人口']) || parseNumber(row['0-1歲人口數']) || parseNumber(row['raw_col_h'] || 0)
      };
    });

    const childcareNowMap = {};
    childcareNowData.forEach(row => {
      const district = normalizeDistrict(row['行政區']);
      childcareNowMap[district] = {
        capacity: parseNumber(row['收托人數']) || parseNumber(row['核定收托人數']) || 0
      };
    });

    const childcareFutureMap = {};
    childcareFutureData.forEach(row => {
      const district = normalizeDistrict(row['行政區']);
      childcareFutureMap[district] = {
        capacity: parseNumber(row['未來增設容量']) || parseNumber(row['預計增設容量']) || 0
      };
    });

    const telecomMap = {};
    telecomData.forEach(row => {
      const district = normalizeDistrict(row['行政區']);
      telecomMap[district] = {
        dayNightRatio: parseNumber(row['日夜間人口比']) || parseNumber(row['日夜間人口比(%)']) || 0
      };
    });

    const districts = new Set([
      ...Object.keys(popMap),
      ...Object.keys(childcareNowMap),
      ...Object.keys(childcareFutureMap),
      ...Object.keys(telecomMap),
    ]);

    const results = [];
    districts.forEach(district => {
      const popInfo = popMap[district] || { pop0_1: 0 };
      const nowInfo = childcareNowMap[district] || { capacity: 0 };
      const futureInfo = childcareFutureMap[district] || { capacity: 0 };
      const telecomInfo = telecomMap[district] || { dayNightRatio: 0 };

      const pop0_1 = popInfo.pop0_1 || 0;
      const capacityNow = nowInfo.capacity || 0;
      const capacityFutureAdd = futureInfo.capacity || 0;
      const capacityFutureTotal = capacityNow + capacityFutureAdd;
      const coverageNow = pop0_1 > 0 ? (capacityNow / pop0_1) : 0;
      const coverageFuture = pop0_1 > 0 ? (capacityFutureTotal / pop0_1) : 0;
      const gapNow = Math.max(pop0_1 - capacityNow, 0);
      const gapFuture = Math.max(pop0_1 - capacityFutureTotal, 0);
      const dayNightRatio = telecomInfo.dayNightRatio || 0;
      const priorityScore = gapNow * (1 + dayNightRatio / 100);

      results.push({
        district,
        pop0_1,
        capacityNow,
        capacityFutureAdd,
        capacityFutureTotal,
        coverageNow,
        coverageFuture,
        gapNow,
        gapFuture,
        dayNightRatio,
        priorityScore
      });
    });

    const cityCapacityNow = results.reduce((sum, row) => sum + row.capacityNow, 0);
    const cityPopNow = results.reduce((sum, row) => sum + row.pop0_1, 0);

    const coverageNowCity = cityPopNow > 0 ? cityCapacityNow / cityPopNow : 0;

    const coverageFutureCity = popFutureTotal > 0 ? cityCapacityNow / popFutureTotal : coverageNowCity;

    const trendArr = [];
    let cumulativeCap = cityCapacityNow;
    trendArr.push({ year: '113(基期)', capacity: cumulativeCap });
    const futureByYear = {};
    childcareFutureData.forEach(row => {
      const year = row['年度'] || row['開辦年度'] || '';
      const cap = parseNumber(row['未來增設容量']) || parseNumber(row['預計增設容量']) || 0;
      if (!futureByYear[year]) futureByYear[year] = 0;
      futureByYear[year] += cap;
    });

    for (let y = 114; y <= 118; y++) {
      const key = `${y}年`;
      const added = futureByYear[key] || 0;
      cumulativeCap += added;
      trendArr.push({ year: key, capacity: cumulativeCap, added });
    }

    return { 
      districtSummary: results.sort((a, b) => b.priorityScore - a.priorityScore),
      cityStats: { 
        coverageNow: coverageNowCity,
        coverageFuture: coverageFutureCity,
        capNow: cityCapacityNow,
        popNow: cityPopNow
      },
      cumulativeTrend: trendArr
    };
  }, [csvData, popData, childcareNowData, childcareFutureData, telecomData, popFutureTotal]);

  const chartData = useMemo(() => {
    if (!districtSummary || !districtSummary.districtSummary) return [];
    return [...districtSummary.districtSummary].sort((a, b) => a.district.localeCompare(b.district)); 
  }, [districtSummary]);

  const priorityList = useMemo(() => 
    districtSummary?.districtSummary ? districtSummary.districtSummary.slice(0, 6) : [], 
  [districtSummary]);

  const Header = () => (
    <div className="bg-white py-6 px-8 border-b border-gray-100 flex justify-between items-center sticky top-0 z-20 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="bg-orange-500 p-2 rounded-lg text-white">
          <Home size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-wide">臺北市社福設施數據儀表板</h1>
          <p className="text-xs text-slate-400 font-medium tracking-widest uppercase mt-0.5">SOCIAL WELFARE DATA JOURNALISM</p>
        </div>
      </div>
      <div className="text-slate-500 text-sm flex items-center gap-2">
        <FileText size={16} />
        <span>資料來源：Google Sheet Live Data</span>
      </div>
    </div>
  );

  const SectionTitle = ({ title, colorClass = "bg-teal-500", icon: Icon }) => (
    <div className="flex items-center gap-3 mb-6">
      <div className={`w-1.5 h-8 ${colorClass}`}></div>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="text-slate-700" size={24} />}
        <h2 className="text-xl font-bold text-slate-700">{title}</h2>
      </div>
    </div>
  );

  const baseList = useMemo(() => {
    const map = {};
    csvData.forEach(row => {
      const baseName = row['基地名稱'] || '';
      const pm = row['PM'] || '';
      if (!baseName) return;
      if (!map[baseName]) {
        map[baseName] = { baseName, pm, facilities: [] };
      }
      map[baseName].facilities.push({
        name: row['設施名稱'] || '',
        type: row['類型'] || '',
        service: row['服務對象'] || '',
        status: row['現況'] || row['營運狀態'] || '',
        floor: row['樓層'] || '',
        area: parseNumber(row['樓地板面積']) || 0
      });
    });
    return Object.values(map).sort((a, b) => a.baseName.localeCompare(b.baseName));
  }, [csvData]);

  const trendData = useMemo(() => {
    const map = {};
    csvData.forEach(row => {
      const year = row['年度'] || row['開辦年度'] || '';
      if (!year) return;
      if (!map[year]) map[year] = { year, new: 0, cumulative: 0 };
      map[year].new += 1;
    });
    const sorted = Object.keys(map).sort().map(year => map[year]);
    let cumulative = 0;
    sorted.forEach(item => {
      cumulative += item.new;
      item.cumulative = cumulative;
    });
    return sorted;
  }, [csvData]);

  const filteredBases = useMemo(() => {
    if (!pmSearchTerm) return baseList;
    const term = pmSearchTerm.toLowerCase();
    return baseList.filter(base => 
      base.baseName.toLowerCase().includes(term) ||
      (base.pm || '').toLowerCase().includes(term) ||
      base.facilities.some(f => f.name.toLowerCase().includes(term))
    );
  }, [baseList, pmSearchTerm]);

  return (
    <div className="min-h-screen bg-orange-50/30 font-sans text-slate-800 pb-20">
      <Header />

      <main className="max-w-[1600px] mx-auto px-8 pt-10 space-y-12">

        {/* --- 第一區塊：基地大樓 PM 查詢 --- */}
        <section>
          <SectionTitle title="基地大樓服務一覽 & PM 查詢" colorClass="bg-indigo-500" icon={Search} />
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 relative">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                    <User className="text-indigo-500" size={20}/>
                    基地 PM 快速查詢
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">輸入基地名稱或 PM 名稱，即可查詢該大樓內的所有服務設施</p>
                </div>
                <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full">
                  <Info size={14} className="text-indigo-400" />
                  <span>資料與社宅參建、委外設施 CSV 即時連動</span>
                </div>
              </div>

              <div ref={dropdownRef} className="relative">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 pr-10"
                      placeholder="輸入基地名稱、PM 名稱或設施名稱關鍵字…"
                      value={pmSearchTerm}
                      onChange={(e) => setPmSearchTerm(e.target.value)}
                      onFocus={() => setIsDropdownOpen(true)}
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  </div>
                  <button
                    onClick={toggleDropdown}
                    className="px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center gap-1"
                  >
                    <Filter size={14} />
                    清單
                    <ChevronDown size={14} className={`${isDropdownOpen ? 'rotate-180' : ''} transition-transform`} />
                  </button>
                </div>

                {isDropdownOpen && (
                  <div className="absolute z-30 mt-1 w-full max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-lg text-sm custom-scrollbar">
                    {baseList.length === 0 ? (
                      <div className="p-4 text-slate-400 text-center text-xs">尚無基地資料</div>
                    ) : (
                      baseList.map((base, index) => (
                        <button
                          key={index}
                          className="w-full text-left px-4 py-3 hover:bg-slate-50 flex flex-col gap-1 border-b border-slate-50 last:border-b-0"
                          onClick={() => handleSelectBase(base)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">{base.baseName}</span>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <User size={12} className="text-slate-300" />
                              PM：{base.pm || '未填寫'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 line-clamp-1">
                            {base.facilities.map(f => f.name).join('、')}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="mt-6 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                <p className="text-xs text-indigo-600 font-medium flex items-start gap-2">
                  <Smartphone size={16} className="mt-0.5" />
                  <span>
                    建議將本儀表板加入手機主畫面，方便現場會勘或與 PM 討論時，快速查詢各基地之服務內容與弱勢家庭覆蓋情形。
                  </span>
                </p>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-8 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[420px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                  <Layout className="text-slate-500" size={20}/>
                  {selectedBase ? `「${selectedBase.baseName}」服務設施列表` : '所有基地服務設施總覽'}
                </h3>
                <span className="text-xs text-slate-400">
                  {filteredBases.length} 棟基地 · {filteredBases.reduce((sum, b) => sum + b.facilities.length, 0)} 個服務據點
                </span>
              </div>

              <div className="max-h-[520px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredBases.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <AlertCircle size={32} className="mb-2 text-slate-300" />
                    <p>查無符合條件的基地，請嘗試其他關鍵字</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredBases.map((base, idx) => (
                      <div key={idx} className="border border-slate-100 rounded-2xl p-4 bg-slate-50/60">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-500">
                              <Building2 size={16} />
                            </div>
                            <div>
                              <h4 className="font-semibold text-slate-800">{base.baseName}</h4>
                              <p className="text-xs text-slate-400 flex items-center gap-1">
                                <User size={12} className="text-slate-300" />
                                PM：{base.pm || '未填寫'}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-500">
                            {base.facilities.length} 個服務據點
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {base.facilities.map((fac, fi) => (
                            <div key={fi} className="bg-white rounded-xl p-3 border border-slate-100 flex flex-col gap-1">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-slate-800">{fac.name}</p>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                                  fac.type.includes('勞務')
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : fac.type.includes('委營')
                                    ? 'bg-blue-50 text-blue-600'
                                    : 'bg-amber-50 text-amber-600'
                                }`}>
                                  {fac.type || '類型未填寫'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                                <span className="flex items-center gap-1">
                                  <Users size={12} className="text-slate-400" />
                                  服務對象：{fac.service || '未填寫'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 size={12} className={fac.status === '已開辦' ? 'text-emerald-500' : 'text-amber-500'} />
                                  {fac.status || '狀態未填寫'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                                <span>樓層：{fac.floor || '未填寫'}</span>
                                <span>樓地板面積：{fac.area ? `${fac.area.toLocaleString()} ㎡` : '未填寫'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </section>

        {/* --- 第二區塊：委外服務設施現況與趨勢 --- */}
        <section>
          <SectionTitle title="委外服務設施現況與趨勢" colorClass="bg-orange-500" icon={Layout} />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-orange-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-500">
                <FileText size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">已開辦總家數</p>
                <h3 className="text-3xl font-bold text-slate-800">{loading ? '...' : stats.total}</h3>
                <p className="text-[10px] text-slate-400 mt-1">含勞務/委營/方案委託(帶地投標)</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-teal-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-500">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">公辦民營(勞務)</p>
                <h3 className="text-3xl font-bold text-slate-800">{loading ? '...' : stats.labor}</h3>
                <p className="text-[10px] text-slate-400 mt-1">現有營運中</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
                <CheckCircle size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">公辦民營(委營)</p>
                <h3 className="text-3xl font-bold text-slate-800">{loading ? '...' : stats.entrust}</h3>
                <p className="text-[10px] text-slate-400 mt-1">現有營運中</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-500">
                <Home size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">社宅參建(方案委託)</p>
                <h3 className="text-3xl font-bold text-slate-800">{loading ? '...' : stats.participated}</h3>
                <p className="text-[10px] text-slate-400 mt-1">含帶地投標之社宅共構設施</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[320px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                  <TrendingUp className="text-orange-500" size={20}/>
                  委外服務增設趨勢
                </h3>
                <p className="text-xs text-slate-400">以年度為單位，統計委外及社宅參建設施開辦數量</p>
              </div>
              <div className="h-[260px]">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-slate-400">載入圖表數據中.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                      <Line type="monotone" dataKey="cumulative" name="累計開辦數" stroke="#F97316" strokeWidth={3} dot={{ r: 4, fill: '#F97316', strokeWidth: 2, stroke: '#fff' }} />
                      <Line type="monotone" dataKey="new" name="該年度新增" stroke="#14B8A6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#14B8A6' }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
              <p className="text-center text-xs text-slate-400 mt-4">* 包含公辦民營(勞務)、公辦民營(委營)、方案委託(帶地投標)之有效存續設施</p>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col gap-4">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <AlertTriangle className="text-rose-500" size={18}/>
                風險與重點提示
              </h3>
              <ul className="space-y-3 text-xs text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  <span>特定行政區委外設施集中度過高，若單一承接單位經營不善，將影響服務穩定性。</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span>社宅參建設施開辦期程與建物工程進度密切相關，需持續與都發及工務單位跨局處協調。</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                  <span>委外與直營服務布建應避免重複投資，同一生活圈建議整合規劃托育、長照及身障資源。</span>
                </li>
              </ul>
              <div className="mt-2 text-[10px] text-slate-400 bg-slate-50 px-3 py-2 rounded-xl">
                * 以上內容為樣板說明，實際風險評估需搭配最新委託契約、履約狀況及地方需求調查結果。
              </div>
            </div>
          </div>
        </section>

        {/* --- 第四區塊：社宅參建 | 福利設施開箱 --- */}
        <section>
          <SectionTitle title="社宅參建 | 福利設施開箱" colorClass="bg-teal-500" icon={Building2} />
          
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[500px]">
              <h3 className="text-lg font-medium text-slate-600 mb-8">服務對象佔比 (社宅參建)</h3>
              <div className="relative w-full h-[300px]">
                {districtSummary?.districtSummary?.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: '托育(0-2歲)', value: 45, color: '#FDBA74' },
                          { name: '長照(失能、高齡)', value: 30, color: '#4ADE80' },
                          { name: '身障服務', value: 15, color: '#60A5FA' },
                          { name: '青銀共居 / 其他', value: 10, color: '#A78BFA' },
                        ]}
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
                        {[
                          { name: '托育(0-2歲)', value: 45, color: '#FDBA74' },
                          { name: '長照(失能、高齡)', value: 30, color: '#4ADE80' },
                          { name: '身障服務', value: 15, color: '#60A5FA' },
                          { name: '青銀共居 / 其他', value: 10, color: '#A78BFA' },
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                   <div className="flex items-center justify-center h-full text-slate-400">無數據</div>
                )}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-300">
                  <Home size={48} strokeWidth={1.5} />
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-6 max-w-xs text-xs text-slate-500">
                {[
                  { name: '托育(0-2歲)', value: 45, color: '#FDBA74' },
                  { name: '長照(失能、高齡)', value: 30, color: '#4ADE80' },
                  { name: '身障服務', value: 15, color: '#60A5FA' },
                  { name: '青銀共居 / 其他', value: 10, color: '#A78BFA' },
                ].map((entry, index) => (
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
                {baseList.length > 0 ? (
                  baseList.map((base, idx) => (
                    <div key={idx} className="relative pl-6 border-l-2 border-teal-100 mb-8 last:mb-0">
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-teal-500 border-4 border-white shadow-sm"></div>
                      <h4 className="text-xl font-bold text-teal-600 mb-4 -mt-1 sticky top-0 bg-white z-10 py-1">{base.baseName}</h4>
                      
                      <div className="space-y-4">
                        {base.facilities.map((fac, i) => (
                          <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <h5 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                               <Building2 size={16} className="text-slate-400"/>
                               {fac.name}
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                               <div className="text-xs text-slate-600">
                                 <span className="font-medium text-slate-500">服務對象：</span>{fac.service || '未填寫'}
                               </div>
                               <div className="text-xs text-slate-600">
                                 <span className="font-medium text-slate-500">營運狀態：</span>
                                 <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                                   fac.status === '已開辦' 
                                     ? 'bg-emerald-50 text-emerald-600' 
                                     : 'bg-amber-50 text-amber-600'
                                 }`}>
                                   {fac.status || '未填寫'}
                                 </span>
                               </div>
                               <div className="text-xs text-slate-600">
                                 <span className="font-medium text-slate-500">據點樓層：</span>{fac.floor || '未填寫'}
                               </div>
                               <div className="text-xs text-slate-600">
                                 <span className="font-medium text-slate-500">樓地板面積：</span>{fac.area ? `${fac.area.toLocaleString()} ㎡` : '未填寫'}
                               </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-400 py-10">尚無社宅參建資料</div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* --- 第五區塊：公托覆蓋率與缺口分析 (New Layout) --- */}
        <section>
          <SectionTitle title="公托覆蓋率與缺口分析" colorClass="bg-rose-500" icon={Baby} />
          
          {/* Top: 趨勢圖 + 全市覆蓋率 */}
          <div className="grid grid-cols-12 gap-6 mb-6">
             <div className="col-span-12 lg:col-span-8 bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
               <div className="flex items-center justify-between mb-4">
                 <div>
                   <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                     <TrendingUp className="text-orange-500" size={20}/>
                     114-118年 公托累計收托量成長趨勢
                   </h3>
                   <p className="text-sm text-slate-400">預計未來四年布建計畫</p>
                 </div>
               </div>
               <div className="h-[250px] w-full">
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={districtSummary?.cumulativeTrend || []} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                     <defs>
                       <linearGradient id="colorCap" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#F97316" stopOpacity={0.1}/>
                         <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <XAxis dataKey="year" tick={{fill: '#94a3b8', fontSize: 12}} />
                     <YAxis 
                       domain={['dataMin - 100', 'auto']} 
                       tick={{fill: '#94a3b8', fontSize: 12}} 
                     />
                     <Tooltip 
                       contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                       formatter={(value) => [`${value}人`, '收托量']}
                     />
                     <Area type="monotone" dataKey="capacity" stroke="#F97316" strokeWidth={3} fillOpacity={1} fill="url(#colorCap)">
                        <LabelList dataKey="capacity" position="top" fill="#F97316" fontSize={12} offset={5} />
                     </Area>
                   </AreaChart>
                 </ResponsiveContainer>
               </div>
             </div>

             <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col justify-center items-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-teal-400"></div>
                
                <div className="mb-4 p-4 bg-blue-50 rounded-full text-blue-500">
                  <Baby size={32} /> 
                </div>

                <h4 className="text-slate-500 font-medium mb-2">臺北市整體公托覆蓋率 (現況)</h4>
                <div className="text-5xl font-bold text-slate-800 mb-4">
                  {((districtSummary?.cityStats?.coverageNow || 0) * 100).toFixed(1)}%
                </div>
                
                <div className="text-sm text-slate-400 bg-slate-50 px-4 py-2 rounded-xl text-center">
                   <p>現有收托 {districtSummary?.cityStats?.capNow || 0} 人</p>
                   <p className="text-xs mt-1 text-slate-400">0-1歲人口 {districtSummary?.cityStats?.popNow || 0} 人</p>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            
            {/* 左側：各行政區覆蓋率圖表 */}
            <div className="col-span-12 lg:col-span-8 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[500px]">
               <div className="flex justify-between items-start mb-6">
                 <div>
                   <h3 className="text-lg font-bold text-slate-700">各行政區公托覆蓋率</h3>
                   <div className="text-sm text-slate-500 mt-2 space-y-1">
                     <p>以 0-1 歲人口為分母，計算各區現況與布建後覆蓋率</p>
                     <p className="text-xs text-slate-400">* 布建後覆蓋率為假設未來人口推估值下之覆蓋情境</p>
                   </div>
                 </div>
                 <div className="text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                   <span className="font-semibold text-slate-500">指標說明：</span>
                   <span>目標至少達 10% 覆蓋</span>
                 </div>
               </div>

               <div className="h-[320px]">
                 {chartData.length ? (
                   <ResponsiveContainer width="100%" height="100%">
                     <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                       <XAxis dataKey="district" angle={-35} textAnchor="end" interval={0} height={60} tick={{fill: '#94a3b8', fontSize: 11}} />
                       <YAxis 
                         axisLine={false} 
                         tickLine={false} 
                         tickFormatter={(v) => `${(v*100).toFixed(0)}%`}
                         tick={{fill: '#94a3b8', fontSize: 11}}
                       />
                       <Tooltip
                         formatter={(val, name) => [`${(val*100).toFixed(1)}%`, name]}
                         labelFormatter={(label, payload) => {
                           if (!payload?.length) return label;
                           const data = payload[0].payload;
                           return `${label}（現況${Math.round(data.capacityNow || 0)}人 / 0-1歲人口 ${Math.round(data.pop0_1 || 0)}人）`;
                         }}
                         contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                       />
                       <Legend verticalAlign="top" height={24} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                       <ReferenceLine y={0.10} stroke="#EF4444" strokeDasharray="3 3">
                          <text x="10" y="10%" dy={-10} fill="#EF4444" fontSize={12} fontWeight="bold">目標 10%</text>
                       </ReferenceLine>
                       <Bar dataKey="coverageNow" name="現況覆蓋率" fill="#60A5FA" barSize={20} radius={[4, 4, 0, 0]} />
                       <Bar dataKey="coverageFuture" name="布建後覆蓋率" fill="#2DD4BF" barSize={20} radius={[4, 4, 0, 0]} />
                     </ComposedChart>
                   </ResponsiveContainer>
                 ) : (
                   <div className="flex flex-col items-center justify-center h-full text-slate-400">
                     <AlertTriangle size={32} className="mb-2 text-slate-300" />
                     <p>暫無公托數據，請確認 CSV 連結是否正確</p>
                   </div>
                 )}
               </div>
            </div>

            {/* 右側：優先改善清單 */}
            <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                  <Target className="text-rose-500" size={18}/>
                  優先改善行政區 Top 6
                </h3>
                <span className="text-[10px] text-slate-400 bg-rose-50 px-2 py-1 rounded-full border border-rose-100">
                  依缺口人數 × 日夜間人口比排序
                </span>
              </div>

              <div className="space-y-3 flex-1">
                 {priorityList && priorityList.length ? (
                   priorityList.map((dist, idx) => (
                     <div key={idx} className="border border-slate-100 rounded-2xl p-3 bg-slate-50/60">
                       <div className="flex justify-between items-center mb-1.5">
                         <div className="flex items-center gap-2">
                           <div className="w-6 h-6 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 text-xs font-bold">
                             {idx + 1}
                           </div>
                           <p className="font-semibold text-slate-800 text-sm">{dist.district}</p>
                         </div>
                         <div className="text-right text-[11px] text-slate-400">
                           <p>日夜間人口比 {dist.dayNightRatio?.toFixed(1) || 0}%</p>
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 mb-2">
                         <div>
                           <p className="text-[10px] text-slate-400">現況覆蓋率</p>
                           <p className="text-sm font-semibold text-slate-700">
                             {(dist.coverageNow * 100 || 0).toFixed(1)}%
                           </p>
                         </div>
                         <div className="text-right">
                           <p className="text-[10px] text-slate-400">布建後覆蓋率</p>
                           <div className="flex items-center justify-end gap-1">
                             <p className="text-lg font-bold text-teal-500">
                               {(dist.coverageFuture * 100 || 0).toFixed(1)}%
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
                   ))
                 ) : (
                   <div className="text-center py-10 text-slate-400 text-sm">
                     載入數據中.
                   </div>
                 )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  * 公托容量全部採用收托人數欄位計算。
                  <br/>
                  * 排序依據優先改善指數 (Priority Score)，不因電信指標變動。
                  <br/>
                  * 日夜比依內政部112年電信信令人口統計計算
                </p>
              </div>
            </div>

          </div>
        </section>

      </main>
      
      <footer className="mt-20 py-8 text-center text-xs text-slate-300 border-t border-slate-100">
        Taipei City Government Social Welfare Dashboard<br />
        Live Data connected to Google Sheet
      </footer>
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

  const HOUSING_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTT-_7yLlXfL46QQFLCIwHKEEcBvBuWNiFAsz5KiyLgAuyI7Ur-UFuf_fC5-uzMSfsivZZ1m_ySEDZe/pub?gid=1272555717&single=true&output=csv";

  useEffect(() => {
    const fetchHousingData = async () => {
      try {
        setLoading(true);
        const res = await fetch(HOUSING_CSV_URL);
        const text = await res.text();

        const rawData = parseData(text, "社宅名稱");

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

    filteredData.forEach((row) => {
      if (String(row["是否為老人戶"]) === "是") eld++;
      if (String(row["是否為身心障礙戶"]) === "是") dis++;
      if (String(row["是否為中低收或弱勢戶"]) === "是") low++;

      const ageGroup = row["年齡區間"] || "";
      if (ageGroups[ageGroup] !== undefined) ageGroups[ageGroup]++;

      const disType = row["障別"] || "未填寫";
      disMap[disType] = (disMap[disType] || 0) + 1;

      const li = row["中低收/弱勢類別"] || "未填寫";
      if (liMap[li] === undefined) liMap[li] = 0;
      liMap[li]++;
    });

    return {
      totalHouseholds: households.size,
      elderHouseholds: eld,
      disabledHouseholds: dis,
      lowIncomeHouseholds: low,
      ageGroups,
      disMap,
      liMap,
    };
  }, [filteredData]);

  const projects = useMemo(
    () => [
      ...new Set(
        data
          .map((r) => (r["社宅名稱"] || "").trim())
          .filter((n) => n && n !== "社宅名稱")
      ),
    ].sort(),
    [data]
  );

  const projectStats = useMemo(() => {
    const map = {};
    filteredData.forEach((row) => {
      const name = (row["社宅名稱"] || "").trim();
      if (!name) return;

      if (!map[name]) {
        map[name] = {
          name,
          totalHouseholds: 0,
          elder: 0,
          disabled: 0,
          lowIncome: 0,
        };
      }
      map[name].totalHouseholds++;
      if (String(row["是否為老人戶"]) === "是") map[name].elder++;
      if (String(row["是否為身心障礙戶"]) === "是") map[name].disabled++;
      if (String(row["是否為中低收或弱勢戶"]) === "是") map[name].lowIncome++;
    });

    return Object.values(map)
      .map((p) => ({
        ...p,
        elderRate: p.totalHouseholds ? (p.elder / p.totalHouseholds) * 100 : 0,
        disabledRate: p.totalHouseholds
          ? (p.disabled / p.totalHouseholds) * 100
          : 0,
        lowIncomeRate: p.totalHouseholds
          ? (p.lowIncome / p.totalHouseholds) * 100
          : 0,
      }))
      .sort((a, b) => b.lowIncomeRate - a.lowIncomeRate);
  }, [filteredData]);

  const ageChartData = useMemo(
    () =>
      Object.entries(stats.ageGroups || {}).map(([key, value]) => ({
        name: key,
        value,
      })),
    [stats]
  );

  const disChartData = useMemo(
    () =>
      Object.entries(stats.disMap || {}).map(([key, value]) => ({
        name: key,
        value,
      })),
    [stats]
  );

  const liChartData = useMemo(
    () =>
      Object.entries(stats.liMap || {}).map(([key, value]) => ({
        name: key,
        value,
      })),
    [stats]
  );

  const disColors = [
    "#6366F1",
    "#22C55E",
    "#F97316",
    "#14B8A6",
    "#FACC15",
    "#EC4899",
    "#0EA5E9",
    "#A855F7",
  ];
  const liColors = ["#22C55E", "#65A30D", "#F97316", "#EF4444", "#6B7280"];

  const handleProjectToggle = (name) => {
    if (selectedProjects.includes(name)) {
      setSelectedProjects(selectedProjects.filter((p) => p !== name));
    } else {
      setSelectedProjects([...selectedProjects, name]);
    }
  };

  const KPICard = ({ title, value, total, icon, colorClass }) => (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="text-xs text-slate-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-slate-800">
            {value.toLocaleString()} 戶
          </p>
        </div>
        <div
          className={`w-11 h-11 rounded-2xl flex items-center justify-center ${colorClass}`}
        >
          {icon}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>佔全部戶數比例</span>
        <span className="font-semibold text-slate-700">
          {total > 0 ? ((value / total) * 100).toFixed(1) : 0}%
        </span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans text-slate-800 pb-16">
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-8 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Home className="text-indigo-500" size={20} />
              臺北市社會住宅弱勢戶數據分析
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              依入住戶資料，分析各社宅弱勢戶型比例、障別與年齡結構
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`px-3 py-1.5 text-xs rounded-full border text-slate-600 flex items-center gap-1 ${
                view === "overview"
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                  : "border-slate-200 bg-white"
              }`}
              onClick={() => setView("overview")}
            >
              <BarChart2 size={14} />
              弱勢概況
            </button>
            <button
              className={`px-3 py-1.5 text-xs rounded-full border text-slate-600 flex items-center gap-1 ${
                view === "comparison"
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                  : "border-slate-200 bg-white"
              }`}
              onClick={() => setView("comparison")}
            >
              <Layout size={14} />
              各社宅比較
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-8 pt-8 space-y-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400 gap-3">
            <Loader2 className="animate-spin" size={32} />
            <p>載入社宅弱勢戶資料中，請稍候…</p>
          </div>
        ) : view === "overview" ? (
          <>
            <section>
              <div className="grid grid-cols-12 gap-6 mb-6">
                <div className="col-span-12 lg:col-span-3">
                  <KPICard
                    title="目前已入住戶數"
                    value={stats.totalHouseholds || 0}
                    total={stats.totalHouseholds || 0}
                    icon={<Home size={20} />}
                    colorClass="bg-indigo-50 text-indigo-500"
                  />
                </div>
                <div className="col-span-12 lg:col-span-3">
                  <KPICard
                    title="老人家庭戶數"
                    value={stats.elderHouseholds || 0}
                    total={stats.totalHouseholds || 0}
                    icon={<Users size={20} />}
                    colorClass="bg-amber-50 text-amber-500"
                  />
                </div>
                <div className="col-span-12 lg:col-span-3">
                  <KPICard
                    title="身心障礙家庭戶數"
                    value={stats.disabledHouseholds || 0}
                    total={stats.totalHouseholds || 0}
                    icon={<Accessibility size={20} />}
                    colorClass="bg-emerald-50 text-emerald-500"
                  />
                </div>
                <div className="col-span-12 lg:col-span-3">
                  <KPICard
                    title="中低收/弱勢家庭戶數"
                    value={stats.lowIncomeHouseholds || 0}
                    total={stats.totalHouseholds || 0}
                    icon={<HandCoins size={20} />}
                    colorClass="bg-rose-50 text-rose-500"
                  />
                </div>
              </div>
            </section>

            <section className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-5 bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Users className="text-indigo-500" size={18} />
                  弱勢家庭年齡結構
                </h3>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ageChartData} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 10,
                          border: "none",
                          boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
                          fontSize: 12,
                        }}
                      />
                      <Bar
                        dataKey="value"
                        radius={[6, 6, 0, 0]}
                        fill="#4F46E5"
                      >
                        <LabelList
                          dataKey="value"
                          position="top"
                          fill="#334155"
                          fontSize={11}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="col-span-12 lg:col-span-7 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Accessibility className="text-emerald-500" size={18} />
                    障別分布
                  </h3>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={disChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {disChartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                disColors[index % disColors.length] || "#CBD5F5"
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name) => [`${value} 戶`, name]}
                          contentStyle={{
                            borderRadius: 10,
                            border: "none",
                            boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
                            fontSize: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-slate-600 max-h-[120px] overflow-y-auto custom-scrollbar">
                    {disChartData.map((d, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-sm"
                          style={{
                            backgroundColor:
                              disColors[idx % disColors.length] || "#CBD5F5",
                          }}
                        ></span>
                        <span className="truncate">{d.name}</span>
                        <span className="ml-auto text-slate-500">
                          {d.value.toLocaleString()} 戶
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <HandCoins className="text-rose-500" size={18} />
                    中低收/弱勢類別分布
                  </h3>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={liChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {liChartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                liColors[index % liColors.length] || "#E5E7EB"
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name) => [`${value} 戶`, name]}
                          contentStyle={{
                            borderRadius: 10,
                            border: "none",
                            boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
                            fontSize: 12,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-4 space-y-2 text-[11px] text-slate-600">
                    {liChartData.map((d, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-sm"
                            style={{
                              backgroundColor:
                                liColors[idx % liColors.length] || "#E5E7EB",
                            }}
                          ></span>
                          <span>{d.name}</span>
                        </div>
                        <span className="text-slate-500">
                          {d.value.toLocaleString()} 戶
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          <section>
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                  <Layout className="text-indigo-500" size={18} />
                  各社宅弱勢戶比例比較
                </h3>
                <p className="text-xs text-slate-500">
                  以每一社宅為單位，比較弱勢家庭(老人/身障/中低收)佔全部戶數之比例
                </p>
              </div>
              <button
                className="px-3 py-1.5 text-xs rounded-full border border-slate-200 text-slate-600 flex items-center gap-1"
                onClick={() => setShowFilter(!showFilter)}
              >
                <Filter size={14} />
                {showFilter ? "隱藏篩選" : "篩選社宅"}
              </button>
            </div>

            {showFilter && (
              <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-100 mb-6">
                <div className="flex flex-wrap gap-2">
                  {projects.map((name) => (
                    <button
                      key={name}
                      onClick={() => handleProjectToggle(name)}
                      className={`px-3 py-1.5 text-xs rounded-full border ${
                        selectedProjects.includes(name)
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                          : "bg-white border-slate-200 text-slate-600"
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
                {selectedProjects.length === 0 && (
                  <p className="mt-3 text-[11px] text-amber-500 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    未選擇任何社宅時，預設顯示全部社宅。
                  </p>
                )}
              </div>
            )}

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <div className="h-[420px]">
                {projectStats.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={projectStats}
                      margin={{ top: 20, right: 30, left: 0, bottom: 80 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />
                      <XAxis
                        dataKey="name"
                        angle={-35}
                        textAnchor="end"
                        interval={0}
                        height={70}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        tickFormatter={(v) => `${v.toFixed(0)}%`}
                      />
                      <Tooltip
                        formatter={(val, name) => [
                          `${val.toFixed(1)}%`,
                          name,
                        ]}
                        labelFormatter={(label, payload) =>
                          payload && payload[0]
                            ? `${label}（${payload[0].payload.totalHouseholds} 戶）`
                            : label
                        }
                        contentStyle={{
                          borderRadius: 12,
                          border: "none",
                          boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
                        }}
                      />
                      <Legend
                        verticalAlign="top"
                        height={24}
                        iconType="circle"
                        wrapperStyle={{ fontSize: 11 }}
                      />
                      <Bar
                        dataKey="elderRate"
                        name="老人家庭比例"
                        stackId="a"
                        radius={[6, 6, 0, 0]}
                      />
                      <Bar
                        dataKey="disabledRate"
                        name="身障家庭比例"
                        stackId="a"
                      />
                      <Bar
                        dataKey="lowIncomeRate"
                        name="中低收/弱勢家庭比例"
                        stackId="a"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <AlertCircle size={32} className="mb-2 text-slate-300" />
                    <p>尚無可供比較的社宅資料</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
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
                 <div className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center bg-slate-50 shadow-lg shadow-indigo-200">
                    <img 
                      src={LOGO_URL} 
                      alt="綜合規劃股儀表板 Logo" 
                      className="w-full h-full object-contain"
                    />
                 </div>
                 <div className="flex flex-col">
                    <h1 className="text-lg font-black text-slate-800 leading-tight">綜合規劃股</h1>
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
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 bg-slate-50/50">
         <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-10">
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

            <div className="animate-in fade-in duration-500 slide-in-from-bottom-4">
                {activeTab === 'welfare' ? <WelfareDashboard /> : <HousingDashboard />}
            </div>
         </div>
      </main>
    </div>
  );
};

export default App;
