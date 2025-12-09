import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Building2, FileText, CheckCircle2, CheckCircle, Layout, Home, Search, User,
  Loader2, ChevronDown, Baby, TrendingUp, AlertTriangle, Target, Info,
  Smartphone, Sun, Moon, X, Users, Accessibility, HeartHandshake,
  BarChart3, PieChart as PieChartIcon, Menu, Calculator, Plus, Trash2, RotateCcw, Filter, 
  Crown, Star, Shield, Zap, Sword, Award, HelpCircle, UserPlus
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, ComposedChart, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, LabelList, Label
} from 'recharts';

// ==========================================
// 共用輔助函式
// ==========================================

const parseNumber = (v) => {
  if (!v) return 0;
  const str = String(v).replace(/,/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

const normalizeDistrict = (name) => {
  if (!name) return '';
  return String(name).trim().replace(/臺/g, '台').replace(/^台北市/, '').replace(/^台彎省/, '').replace(/\s+/g, '').replace(/區$/, '');
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
      if (line[i] === '"') {
        inQuotes = !inQuotes;
      } else if (line[i] === separator && !inQuotes) {
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
    const entry = { _raw: values }; // 保留原始陣列以供 Index 存取
    headers.forEach((header, index) => {
      const cleanHeader = header.replace(/^\uFEFF/, '').trim();
      if (cleanHeader) {
        entry[cleanHeader] = values[index] || '';
      }
    });
    return entry;
  });
};

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
    if (cols.length > 7) entry['raw_col_h'] = cols[7];
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
  if (cols.length > 1) return parseNumber(cols[1].replace(/^"|"$/g, ''));
  return 0;
};

const COLORS = {
  targets: ['#F97316', '#14B8A6', '#EC4899', '#8B5CF6', '#3B82F6', '#EAB308', '#EF4444', '#6366F1'],
  bar: '#3B82F6'
};

// ==========================================
// 1. 社福設施頁面 (SocialWelfareView)
// ==========================================
const SocialWelfareView = () => {
  const [csvData, setCsvData] = useState([]); 
  const [popData, setPopData] = useState([]);
  const [childcareNowData, setChildcareNowData] = useState([]);
  const [childcareFutureData, setChildcareFutureData] = useState([]);
  const [telecomData, setTelecomData] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [pmSearchTerm, setPmSearchTerm] = useState('');
  const [selectedBase, setSelectedBase] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    const fetchAllData = async () => {
      try {
        setLoading(true);
        const MAIN_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=0&single=true&output=csv';
        const POPULATION_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=513929673&single=true&output=csv';
        const CHILDCARE_NOW_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=951116094&single=true&output=csv';
        const CHILDCARE_FUTURE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=47182957&single=true&output=csv';
        const POP_FUTURE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=1074300767&single=true&output=csv';
        const TELECOM_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=1894885880&single=true&output=csv';

        const [resMain, resPop, resNow, resFuture, resTelecom] = await Promise.all([
          fetch(MAIN_SHEET_URL).then(r => r.text()),
          fetch(POPULATION_URL).then(r => r.text()),
          fetch(CHILDCARE_NOW_URL).then(r => r.text()),
          fetch(CHILDCARE_FUTURE_URL).then(r => r.text()),
          fetch(TELECOM_URL).then(r => r.text())
        ]);

        setCsvData(parseData(resMain));
        setPopData(parsePopulationData(resPop));
        setChildcareNowData(parseData(resNow));
        setChildcareFutureData(parseData(resFuture));
        setTelecomData(parseData(resTelecom));
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  const processedData = useMemo(() => {
    if (csvData.length === 0) return [];
    const findKey = (obj, keywords) => {
        if (!obj) return null;
        return Object.keys(obj).find(k => {
            const cleanKey = k.replace(/\s/g, ''); 
            return keywords.some(w => cleanKey.includes(w));
        });
    };
    const firstRow = csvData[0];
    const colId = findKey(firstRow, ['機構代碼']);
    const colServiceTarget = findKey(firstRow, ['服務對象']);
    const colName = findKey(firstRow, ['設施名稱', '機構名稱']);
    const colFacType = findKey(firstRow, ['設施類型', '設施類型代碼']); 
    const colType = findKey(firstRow, ['辦理類型']);
    const colDistrict = findKey(firstRow, ['行政區']);
    const colBase = findKey(firstRow, ['基地名稱']);
    const colStartYear = findKey(firstRow, ['開辦年度']);
    const colStatus = findKey(firstRow, ['開辦狀態', '是否開辦']);
    const colAcqMethod = findKey(firstRow, ['建物取得方式']);
    const colPM = findKey(firstRow, ['PM']);

    return csvData.map(row => {
      const rawFacType = (row[colFacType] || '').trim();
      const facType = rawFacType.toLowerCase();
      const status = (row[colStatus] || '').trim();
      return {
        id: row[colId],
        serviceTarget: row[colServiceTarget],
        name: row[colName],
        rawFacType, facType, type: row[colType],
        district: row[colDistrict],
        baseName: row[colBase],
        startYear: parseInt(row[colStartYear]) || null,
        status, acqMethod: row[colAcqMethod], pmName: row[colPM]
      };
    });
  }, [csvData]);

  const baseList = useMemo(() => {
    return processedData
      .filter(item => item.baseName && item.baseName.trim() !== '' && item.pmName && item.pmName.trim() !== '')
      .filter((item, index, self) => index === self.findIndex((t) => t.baseName === item.baseName));
  }, [processedData]);

  const filteredBases = useMemo(() => {
    if (!pmSearchTerm) return baseList;
    return baseList.filter(item => item.baseName.includes(pmSearchTerm));
  }, [baseList, pmSearchTerm]);

  const stats = useMemo(() => {
    const typeLabor = "公辦民營(勞務)";
    const typeCommission = "公辦民營(委營)";
    const typeProgram = "方案委託(帶地投標)";
    const isActive = (item) => item.status === "已開辦";
    let total = new Set(), labor = new Set(), commission = new Set(), program = new Set();
    processedData.forEach(item => {
      if (isActive(item)) {
        if ([typeLabor, typeCommission, typeProgram].includes(item.type)) total.add(item.id);
        if (item.type === typeLabor) labor.add(item.id);
        if (item.type === typeCommission) commission.add(item.id);
        if (item.type === typeProgram) program.add(item.id);
      }
    });
    return { total: total.size, labor: labor.size, commission: commission.size, program: program.size };
  }, [processedData]);

  const trendData = useMemo(() => {
    const startRange = 110, endRange = 123;
    const result = [];
    const targetTypes = ["公辦民營(勞務)", "公辦民營(委營)", "方案委託(帶地投標)"];
    for (let year = startRange; year <= endRange; year++) {
      let activeSet = new Set(), newSet = new Set();
      processedData.forEach(item => {
        if (!targetTypes.includes(item.type) || !item.id || !item.startYear) return;
        const hasStarted = item.startYear <= year;
        let hasEnded = false;
        if ((item.status === '已結束' || item.status === '已撤點') && item.endYear && year > item.endYear) hasEnded = true;
        if (hasStarted && !hasEnded) activeSet.add(item.id);
        if (item.startYear === year) newSet.add(item.id);
      });
      result.push({ year: `${year}年`, cumulative: activeSet.size, new: newSet.size });
    }
    return result;
  }, [processedData]);

  const housingPieData = useMemo(() => {
    const housingData = processedData.filter(d => d.acqMethod === '社宅參建');
    const countMap = {};
    housingData.forEach(item => {
      if (item.serviceTarget) countMap[item.serviceTarget] = (countMap[item.serviceTarget] || 0) + 1;
    });
    return Object.entries(countMap)
      .map(([name, value], index) => ({
        name, value, color: COLORS.targets[index % COLORS.targets.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [processedData]);

  const housingTimeline = useMemo(() => {
    const rawList = processedData.filter(d => d.acqMethod === '社宅參建' && d.baseName);
    const baseMap = {}; 
    rawList.forEach(item => {
      if (!['已開辦', '未開辦'].includes(item.status)) return;
      if (!baseMap[item.baseName]) baseMap[item.baseName] = { minYear: 9999, facilities: [] };
      if (item.startYear && item.startYear < baseMap[item.baseName].minYear) baseMap[item.baseName].minYear = item.startYear;
      baseMap[item.baseName].facilities.push(item);
    });
    const yearGroups = {}; 
    Object.entries(baseMap).forEach(([baseName, data]) => {
      const year = data.minYear === 9999 ? '未定' : data.minYear;
      if (!yearGroups[year]) yearGroups[year] = [];
      yearGroups[year].push({ baseName, facilities: data.facilities });
    });
    return Object.entries(yearGroups)
      .map(([year, bases]) => ({ year: year === '未定' ? '未定' : `${year}年`, bases: bases }))
      .sort((a, b) => {
        if (a.year === '未定') return 1;
        if (b.year === '未定') return -1;
        return parseInt(a.year) - parseInt(b.year);
      });
  }, [processedData]);

  const { districtSummary, cityStats, cumulativeTrend, priorityList, chartData } = useMemo(() => {
    if (popData.length === 0 && childcareNowData.length === 0) return { districtSummary: [], cityStats: {}, cumulativeTrend: [], priorityList: [], chartData: [] };
    
    const getVal = (obj, keywords) => {
      const k = Object.keys(obj).find(k => keywords.some(w => k.includes(w)));
      return k ? parseNumber(obj[k]) : 0;
    };
    const getStr = (obj, keywords) => {
      const k = Object.keys(obj).find(k => keywords.some(w => k.includes(w)));
      return k && obj[k] ? String(obj[k]).trim() : '';
    };

    const districtMap = {};
    popData.forEach(row => {
      const rawDist = getStr(row, ['行政區', '區別', '區']);
      if (!rawDist || rawDist.includes('總計') || rawDist.includes('單位')) return;
      const normDist = normalizeDistrict(rawDist);
      if (!normDist) return;
      const pop0 = getVal(row, ['0歲', '0 歲', '零歲']);
      const pop1 = getVal(row, ['1歲', '1 歲', '一歲']);
      const popFuture = parseNumber(row['raw_col_h']);
      if (!districtMap[normDist]) districtMap[normDist] = { district: rawDist, popNow: 0, popFuture: 0, capacityNow: 0, futureCapacity: 0, telecom: { day: 0, night: 0 } };
      districtMap[normDist].popNow += (pop0 + pop1);
      districtMap[normDist].popFuture += popFuture;
    });

    let cityCapacityNow = 0;
    childcareNowData.forEach(row => {
      const rawDist = getStr(row, ['行政區', '區別', '區']);
      if (!rawDist || rawDist.includes('總計')) return;
      const normDist = normalizeDistrict(rawDist);
      const cap = getVal(row, ['收托人數', '收托', '容量']);
      if (cap > 0) {
        cityCapacityNow += cap;
        if (districtMap[normDist]) districtMap[normDist].capacityNow += cap;
        else if (districtMap[normDist + '區']) districtMap[normDist + '區'].capacityNow += cap;
      }
    });

    telecomData.forEach(row => {
      const rawDist = getStr(row, ['行政區', '區別']);
      const normDist = normalizeDistrict(rawDist);
      if (districtMap[normDist]) {
        districtMap[normDist].telecom.night = getVal(row, ['夜間', '停留']);
        districtMap[normDist].telecom.day = getVal(row, ['日間活動', '日間']);
      }
    });

    const futureByYear = {}; 
    let cityCapacityFuture = 0;
    childcareFutureData.forEach(row => {
      const rawDist = getStr(row, ['行政區', '區別', '區']); 
      const normDist = normalizeDistrict(rawDist);
      const yearRaw = getStr(row, ['年度', '開辦', '年']);
      const year = parseInt(yearRaw.replace(/[^0-9]/g, '')) || 0;
      const cap = getVal(row, ['收托人數', '收托']); 
      
      if (cap > 0) {
        cityCapacityFuture += cap;
        if (districtMap[normDist]) districtMap[normDist].futureCapacity += cap;
        if (year >= 114 && year <= 118) futureByYear[year] = (futureByYear[year] || 0) + cap;
      }
    });

    const TARGET_COVERAGE_RATE = 0.10; 
    const results = Object.values(districtMap).map(d => {
      const displayName = d.district.endsWith('區') ? d.district : d.district + '區';
      const coverageNow = d.popNow > 0 ? (d.capacityNow / d.popNow) : 0;
      const futurePop = d.popFuture > 0 ? d.popFuture : d.popNow;
      const capacityFutureTotal = d.capacityNow + d.futureCapacity;
      const coverageFuture = futurePop > 0 ? (capacityFutureTotal / futurePop) : 0;
      const gapNow = Math.max(0, (d.popNow * TARGET_COVERAGE_RATE) - d.capacityNow);
      const gapFuture = Math.max(0, (futurePop * TARGET_COVERAGE_RATE) - capacityFutureTotal);
      const dayNightRatio = d.telecom.night > 0 ? (d.telecom.day / d.telecom.night) : 1;
      const priorityScore = gapFuture + (gapNow * 0.5); 
      return { district: displayName, popNow: d.popNow, capacityNow: d.capacityNow, futurePop, capacityFutureTotal, coverageNow, coverageFuture, gapNow, gapFuture, dayNightRatio, priorityScore };
    });

    const trendArr = [];
    let cumulativeCap = cityCapacityNow;
    trendArr.push({ year: '113(基期)', capacity: cumulativeCap });
    for (let y = 114; y <= 118; y++) {
      const added = futureByYear[y] || 0;
      cumulativeCap += added;
      trendArr.push({ year: `${y}年`, capacity: cumulativeCap, added });
    }

    const sortedSummary = results.sort((a, b) => b.priorityScore - a.priorityScore);

    return { 
      districtSummary: sortedSummary,
      cityStats: { 
        coverageNow: Object.values(districtMap).reduce((acc, curr) => acc + curr.popNow, 0) > 0 
          ? cityCapacityNow / Object.values(districtMap).reduce((acc, curr) => acc + curr.popNow, 0) : 0, 
        capNow: cityCapacityNow,
        popNow: Object.values(districtMap).reduce((acc, curr) => acc + curr.popNow, 0)
      },
      cumulativeTrend: trendArr,
      priorityList: sortedSummary.slice(0, 6),
      chartData: [...sortedSummary].sort((a, b) => a.district.localeCompare(b.district))
    };
  }, [popData, childcareNowData, childcareFutureData, telecomData]);

  const SectionTitle = ({ title, colorClass = "bg-teal-500", icon: Icon }) => (
    <div className="flex items-center gap-3 mb-6">
      <div className={`w-1.5 h-8 ${colorClass}`}></div>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="text-slate-700" size={24} />}
        <h2 className="text-xl font-bold text-slate-700">{title}</h2>
      </div>
    </div>
  );

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
          <SectionTitle title="新建工程基地大樓 PM 查詢" colorClass="bg-blue-500" icon={User} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="relative" ref={dropdownRef}>
              <label className="block text-sm font-medium text-slate-600 mb-2">搜尋基地名稱</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder="請輸入關鍵字或從選單選擇..."
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={toggleDropdown}
                >
                  <ChevronDown size={20} />
                </button>
              </div>

              {isDropdownOpen && filteredBases.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl max-h-60 overflow-y-auto z-50">
                  {filteredBases.map((item, idx) => (
                    <div
                      key={idx}
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-slate-700 border-b border-slate-50 last:border-0"
                      onClick={() => handleSelectBase(item)}
                    >
                      {item.baseName}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100 min-h-[120px] flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium mb-1">對應 PM (專案負責人)</p>
                <div className="text-2xl font-bold text-slate-800">
                  {selectedBase ? (
                    selectedBase.pmName && selectedBase.pmName.trim() !== '' ? selectedBase.pmName : <span className="text-slate-400 text-lg">查無</span>
                  ) : (
                    <span className="text-slate-300 text-lg">-- 請選擇基地 --</span>
                  )}
                </div>
              </div>
              <div className="bg-white p-3 rounded-full shadow-sm text-blue-500">
                <User size={32} />
              </div>
            </div>
          </div>
      </section>

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
                <p className="text-[10px] text-slate-400 mt-1">含勞務/委營/方案委託</p>
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
                <h3 className="text-3xl font-bold text-slate-800">{loading ? '...' : stats.commission}</h3>
                <p className="text-[10px] text-slate-400 mt-1">現有營運中</p>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-rose-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-500">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">方案委託</p>
                <h3 className="text-3xl font-bold text-slate-800">{loading ? '...' : stats.program}</h3>
                <p className="text-[10px] text-slate-400 mt-1">現有營運中</p>
              </div>
            </div>
          </div>
      </section>

      <section>
           <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
            <div className="flex items-center gap-2 mb-8">
              <div className="text-orange-500 bg-orange-50 p-1.5 rounded-lg">
                <span className="text-xl font-bold">↗</span>
              </div>
              <h3 className="text-lg font-bold text-slate-700">110-123年 委外設施數量成長趨勢</h3>
            </div>
            <div className="h-[400px] w-full">
              {loading ? (
                <div className="h-full flex items-center justify-center text-slate-400">載入圖表數據中...</div>
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
          </div>
      </section>

      <section>
          <SectionTitle title="社宅參建 | 福利設施開箱" colorClass="bg-teal-500" icon={Building2} />
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[500px]">
              <h3 className="text-lg font-medium text-slate-600 mb-8">服務對象佔比 (社宅參建)</h3>
              <div className="relative w-full h-[300px]">
                {housingPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={housingPieData} innerRadius={80} outerRadius={120} paddingAngle={2} dataKey="value" stroke="none">
                        {housingPieData.map((entry, index) => (
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
                {housingTimeline.length > 0 ? (
                  housingTimeline.map((yearGroup, idx) => (
                    <div key={idx} className="relative pl-6 border-l-2 border-teal-100 mb-8 last:mb-0">
                      <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-teal-500 border-4 border-white shadow-sm"></div>
                      <h4 className="text-xl font-bold text-teal-600 mb-4 -mt-1 sticky top-0 bg-white z-10 py-1">{yearGroup.year}</h4>
                      <div className="space-y-4">
                        {yearGroup.bases.map((base, i) => (
                          <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <h5 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
                               <Building2 size={16} className="text-slate-400"/>
                               {base.baseName}
                            </h5>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                               {base.facilities.map((fac, j) => (
                                 <div key={j} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-100 text-sm">
                                    <span className="text-slate-600 truncate mr-2">{fac.name}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                                      fac.status === '已開辦' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                    }`}>
                                      {fac.status}
                                    </span>
                                 </div>
                               ))}
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

      <section>
          <SectionTitle title="公托覆蓋率與缺口分析" colorClass="bg-rose-500" icon={Baby} />
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
                   <AreaChart data={cumulativeTrend} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                     <defs>
                       <linearGradient id="colorCap" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#F97316" stopOpacity={0.1}/>
                         <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <XAxis dataKey="year" tick={{fill: '#94a3b8', fontSize: 12}} />
                     <YAxis domain={['dataMin - 100', 'auto']} tick={{fill: '#94a3b8', fontSize: 12}} />
                     <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(value) => [`${value}人`, '收托量']} />
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
                  {(cityStats?.coverageNow * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-slate-400 bg-slate-50 px-4 py-2 rounded-xl text-center">
                   <p>現有收托 {cityStats?.capNow} 人</p>
                   <p className="text-xs mt-1 text-slate-400">0-1歲人口 {cityStats?.popNow} 人</p>
                </div>
             </div>
          </div>
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[500px]">
               <h3 className="text-lg font-bold text-slate-700 mb-6">各行政區公托覆蓋率</h3>
               <div className="h-[400px] w-full">
                 {chartData.length > 0 ? (
                   <ResponsiveContainer width="100%" height="100%">
                     <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 10 }} barGap={4}>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                       <XAxis dataKey="district" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                       <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => `${(val * 100).toFixed(0)}%`} />
                       
                       <Tooltip 
                          cursor={{fill: '#f8fafc'}}
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-100 text-sm min-w-[220px]">
                                  <h4 className="font-bold text-slate-800 text-lg mb-3">{label}</h4>
                                  <div className="mb-3">
                                    <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
                                      <span>現況 (vs 0-1歲人口)</span>
                                      <span>{data.popNow}人</span>
                                    </div>
                                    <div className="flex justify-between items-end text-blue-500">
                                      <span className="text-sm font-medium">容量 {data.capacityNow}</span>
                                      <span className="text-xl font-bold">{(data.coverageNow * 100).toFixed(1)}%</span>
                                    </div>
                                  </div>
                                  <div className="border-t border-slate-100 my-3"></div>
                                  <div>
                                    <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
                                      <span>布建後 (118年推估)</span>
                                      <span>{data.futurePop}人</span>
                                    </div>
                                    <div className="flex justify-between items-end text-teal-500">
                                      <span className="text-sm font-medium">總容量 {data.capacityFutureTotal}</span>
                                      <span className="text-xl font-bold">{(data.coverageFuture * 100).toFixed(1)}%</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                       />

                       <ReferenceLine y={0.10} stroke="#EF4444" strokeDasharray="3 3">
                          <Label value="目標 10%" position="insideTopLeft" fill="#EF4444" fontSize={12} fontWeight="bold" dy={-20} />
                       </ReferenceLine>
                       <Bar dataKey="coverageNow" name="現況覆蓋率" fill="#60A5FA" barSize={20} radius={[4, 4, 0, 0]} />
                       <Bar dataKey="coverageFuture" name="布建後覆蓋率" fill="#2DD4BF" barSize={20} radius={[4, 4, 0, 0]} />
                     </ComposedChart>
                   </ResponsiveContainer>
                 ) : (
                   <div className="flex flex-col items-center justify-center h-full text-slate-400"><p>暫無公托數據</p></div>
                 )}
               </div>
            </div>

            <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[500px] flex flex-col">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                  <AlertTriangle className="text-rose-500" size={20} />
                  優先改善行政區
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                 {priorityList.length > 0 ? (
                   priorityList.map((dist, idx) => {
                     let badgeColor = dist.coverageFuture < 0.05 ? "bg-rose-100 text-rose-700" : (dist.coverageFuture < 0.10 ? "bg-orange-100 text-orange-700" : "bg-green-100 text-green-700");
                     let badgeText = dist.coverageFuture < 0.05 ? "嚴重不足" : (dist.coverageFuture < 0.10 ? "未達標" : "達標");
                     let telecomTag = "", telecomIcon = null;
                     if (dist.dayNightRatio >= 1.2) { telecomTag = "通勤熱區"; telecomIcon = <Sun size={12} className="text-amber-500"/>; } 
                     else if (dist.dayNightRatio < 0.9) { telecomTag = "住宅型"; telecomIcon = <Moon size={12} className="text-indigo-500"/>; }

                     return (
                       <div key={dist.district} className="p-4 rounded-xl border border-slate-100 hover:shadow-md transition-shadow group bg-slate-50/50">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">{idx + 1}</span>
                              <span className="font-bold text-slate-700">{dist.district}</span>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>{badgeText}</span>
                          </div>
                          <div className="flex items-center gap-2 mb-3 bg-white px-2 py-1 rounded border border-slate-100 w-fit">
                             <Smartphone size={12} className="text-slate-400"/>
                             <span className="text-[10px] text-slate-500">日夜比: {dist.dayNightRatio.toFixed(2)}</span>
                             {telecomTag && (<div className="flex items-center gap-1 ml-1 pl-1 border-l border-slate-200">{telecomIcon}<span className="text-[10px] font-medium text-slate-600">{telecomTag}</span></div>)}
                          </div>
                          <div className="grid grid-cols-2 gap-4 mb-2">
                             <div><p className="text-[10px] text-slate-400">現況覆蓋率</p><p className="text-lg font-bold text-blue-500">{(dist.coverageNow * 100).toFixed(1)}%</p></div>
                             <div className="text-right"><p className="text-[10px] text-slate-400">布建後覆蓋率</p><p className="text-lg font-bold text-teal-500">{(dist.coverageFuture * 100).toFixed(1)}%</p></div>
                          </div>
                       </div>
                     );
                   })
                 ) : (<div className="text-center py-10 text-slate-400 text-sm">載入數據中...</div>)}
              </div>
            </div>
          </div>
      </section>
    </div>
  );
};

// ==========================================
// 2-1. 社宅評點小遊戲 (SocialHousingScoringGame - RPG Ver.)
// ==========================================

const SocialHousingScoringGame = () => {
  // 狀態管理
  const initialFamilyStatus = {
    isLowIncome: false, hasTwoKids: false, isSingleParent: false, isGrandparent: false,
    isSpousePrison: false, isDisabledAlone: false, isElderlyAlone: false, isDVVictim: false, isUnderageParent: false,
  };

  const initialMember = { 
    id: 1, name: '申請人', age: '', 
    isIndigenous: false, disabilityLevel: 'none', specialDisability: false, 
    isIncapable: false, isHIV: false, isHomeless: false, isFosterEnd: false 
  };

  const [familyStatus, setFamilyStatus] = useState(initialFamilyStatus);
  const [members, setMembers] = useState([initialMember]);

  // 重置
  const resetGame = () => {
    if (window.confirm('確定要重置所有資料嗎？')) {
      setFamilyStatus(initialFamilyStatus);
      setMembers([{ ...initialMember, id: Date.now() }]);
    }
  };

  // 計算邏輯
  const scoreResult = useMemo(() => {
    let familyScore = 0;
    let memberScore = 0;
    let breakdown = { family: [], age: [], disability: [], other: [] };

    // Family Logic
    if (familyStatus.isLowIncome) { familyScore += 7; breakdown.family.push({ label: '中低收入戶', points: 7 }); }
    if (familyStatus.hasTwoKids) { familyScore += 3; breakdown.family.push({ label: '育有2名未滿18子女', points: 3 }); }
    if (familyStatus.isSingleParent) { familyScore += 3; breakdown.family.push({ label: '單親家庭', points: 3 }); }
    if (familyStatus.isGrandparent) { familyScore += 3; breakdown.family.push({ label: '隔代教養', points: 3 }); }
    if (familyStatus.isSpousePrison) { familyScore += 3; breakdown.family.push({ label: '配偶服刑中', points: 3 }); }
    
    if (familyStatus.isElderlyAlone) { 
      familyScore += 10; breakdown.family.push({ label: '65歲以上獨居長者', points: 10 }); 
    } else if (familyStatus.isDisabledAlone) { 
      familyScore += 10; breakdown.family.push({ label: '獨居身障者', points: 10 }); 
    }

    if (familyStatus.isDVVictim) { familyScore += 3; breakdown.family.push({ label: '家暴/性侵受害者', points: 3 }); }
    if (familyStatus.isUnderageParent) { familyScore += 3; breakdown.family.push({ label: '未成年懷孕/生育', points: 3 }); }

    // Member Logic
    members.forEach((m, idx) => {
      const name = m.name || `成員${idx+1}`;
      const age = parseInt(m.age) || 0;
      
      // Age
      if (m.age !== '') {
          if (age < 7) { memberScore += 6; breakdown.age.push({ label: `${name} (未滿7歲)`, points: 6 }); }
          else if (age >= 7 && age < 18) { memberScore += 4; breakdown.age.push({ label: `${name} (7-18歲)`, points: 4 }); }
          
          let pElder = 0;
          if (m.isIndigenous) {
            if (age >= 65) pElder = 10;
            else if (age >= 60) pElder = 8;
            else if (age >= 55) pElder = 7;
          } else {
            if (age >= 75) pElder = 10;
            else if (age >= 70) pElder = 8;
            else if (age >= 65) pElder = 7;
          }
          if (pElder > 0) { memberScore += pElder; breakdown.age.push({ label: `${name} (長者)`, points: pElder }); }
      }

      // Disability
      if (m.disabilityLevel === 'mild_mod') { memberScore += 5; breakdown.disability.push({ label: `${name} (輕/中度身障)`, points: 5 }); }
      if (m.disabilityLevel === 'severe') { memberScore += 7; breakdown.disability.push({ label: `${name} (重/極重度身障)`, points: 7 }); }
      if (m.specialDisability) { memberScore += 10; breakdown.disability.push({ label: `${name} (特定障礙類別)`, points: 10 }); }

      // Other
      if (m.isIncapable) { memberScore += 5; breakdown.other.push({ label: `${name} (失能)`, points: 5 }); }
      if (m.isHIV) { memberScore += 3; breakdown.other.push({ label: `${name} (愛滋感染)`, points: 3 }); }
      if (m.isHomeless) { memberScore += 3; breakdown.other.push({ label: `${name} (街友)`, points: 3 }); }
      if (m.isFosterEnd) { memberScore += 3; breakdown.other.push({ label: `${name} (結束安置)`, points: 3 }); }
    });

    const total = familyScore + memberScore;
    
    // Rank System
    let rank = { title: "剛入門候補", color: "text-slate-400", bg: "bg-slate-100", icon: User };
    if (total >= 40) rank = { title: "傳說級候補", color: "text-amber-500", bg: "bg-amber-100", icon: Crown };
    else if (total >= 25) rank = { title: "高優先戶", color: "text-rose-500", bg: "bg-rose-100", icon: Star };
    else if (total >= 10) rank = { title: "基本合格", color: "text-blue-500", bg: "bg-blue-100", icon: CheckCircle };

    return { total, familyScore, memberScore, breakdown, rank };
  }, [familyStatus, members]);

  // Operations
  const toggleStatus = (key) => {
    setFamilyStatus(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (key === 'isElderlyAlone' && next.isElderlyAlone) next.isDisabledAlone = false;
      if (key === 'isDisabledAlone' && next.isDisabledAlone) next.isElderlyAlone = false;
      return next;
    });
  };

  const addMember = () => {
    setMembers(prev => [
      ...prev, 
      { id: Date.now(), name: `成員 ${prev.length + 1}`, age: '', isIndigenous: false, disabilityLevel: 'none', specialDisability: false, isIncapable: false, isHIV: false, isHomeless: false, isFosterEnd: false }
    ]);
  };

  const removeMember = (id) => {
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const updateMember = (id, field, value) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  return (
    <div className="grid grid-cols-12 gap-8 animate-in fade-in duration-500">
      
      {/* LEFT: Game Area */}
      <div className="col-span-12 lg:col-span-8 space-y-8">
        
        {/* Guild Skills (Family) */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
             <Shield size={120} />
          </div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
               <Shield size={20}/>
            </div>
            <div>
               <h3 className="text-xl font-bold text-slate-700">公會被動技能 (家庭狀態)</h3>
               <p className="text-xs text-slate-400">這些條件以「戶」為單位，符合即可獲得全隊加成</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 relative z-10">
            <SkillCard label="中低收入戶" point={7} active={familyStatus.isLowIncome} onClick={() => toggleStatus('isLowIncome')} icon={HeartHandshake} />
            <SkillCard label="育有2名未滿18子女" point={3} active={familyStatus.hasTwoKids} onClick={() => toggleStatus('hasTwoKids')} icon={Baby} />
            <SkillCard label="單親家庭" point={3} active={familyStatus.isSingleParent} onClick={() => toggleStatus('isSingleParent')} icon={User} />
            <SkillCard label="隔代教養" point={3} active={familyStatus.isGrandparent} onClick={() => toggleStatus('isGrandparent')} icon={Users} />
            <SkillCard label="家暴/性侵受害" point={3} active={familyStatus.isDVVictim} onClick={() => toggleStatus('isDVVictim')} icon={AlertTriangle} />
            <SkillCard label="未成年懷孕/育兒" point={3} active={familyStatus.isUnderageParent} onClick={() => toggleStatus('isUnderageParent')} icon={Baby} />
            <SkillCard label="配偶服刑(1年以上)" point={3} active={familyStatus.isSpousePrison} onClick={() => toggleStatus('isSpousePrison')} icon={FileText} />
            <SkillCard label="65歲以上獨居" point={10} active={familyStatus.isElderlyAlone} onClick={() => toggleStatus('isElderlyAlone')} icon={User} color="rose" disabled={familyStatus.isDisabledAlone} />
            <SkillCard label="獨居身障者" point={10} active={familyStatus.isDisabledAlone} onClick={() => toggleStatus('isDisabledAlone')} icon={Accessibility} color="rose" disabled={familyStatus.isElderlyAlone} />
          </div>
        </section>

        {/* Characters (Members) */}
        <section className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                 <Users size={20}/>
              </div>
              <div>
                 <h3 className="text-xl font-bold text-slate-700">隊伍成員 (個別狀況)</h3>
                 <p className="text-xs text-slate-400">為每位成員設定屬性，累積更多分數</p>
              </div>
            </div>
            <button onClick={addMember} className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors text-sm shadow-lg shadow-slate-200">
              <Plus size={16}/> 招募成員
            </button>
          </div>

          <div className="space-y-4">
            {members.map((m, idx) => (
              <CharacterCard key={m.id} data={m} onUpdate={updateMember} onRemove={removeMember} idx={idx} />
            ))}
          </div>
        </section>
      </div>

      {/* RIGHT: Battle Stats (Sticky) */}
      <div className="col-span-12 lg:col-span-4">
        <div className="sticky top-24 bg-slate-900 text-white rounded-3xl p-6 shadow-2xl border border-slate-700">
           {/* Header */}
           <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
             <div className="flex items-center gap-2">
               <Sword size={20} className="text-yellow-400"/>
               <span className="font-bold tracking-wider">戰力儀表板</span>
             </div>
             <button onClick={resetGame} className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white" title="重置計算">
                <RotateCcw size={16} />
             </button>
           </div>
           
           {/* Total Score */}
           <div className="text-center mb-8 relative">
             <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full border-4 ${scoreResult.rank.bg.replace('bg-', 'border-').replace('100', '500')} mb-3 bg-slate-800`}>
                <scoreResult.rank.icon size={40} className={scoreResult.rank.color} />
             </div>
             <div className="text-5xl font-black text-white tracking-tight mb-1">{scoreResult.total}</div>
             <div className={`text-sm font-bold px-3 py-1 rounded-full inline-block ${scoreResult.rank.bg} ${scoreResult.rank.color}`}>
                {scoreResult.rank.title}
             </div>
           </div>

           {/* Stat Bars */}
           <div className="space-y-4 mb-6">
             <StatBar label="家庭加成" value={scoreResult.familyScore} color="bg-blue-500" icon={Home} />
             <StatBar label="年齡加成" value={scoreResult.breakdown.age.reduce((a,b)=>a+b.points,0)} color="bg-emerald-500" icon={Baby} />
             <StatBar label="身障加成" value={scoreResult.breakdown.disability.reduce((a,b)=>a+b.points,0)} color="bg-purple-500" icon={Accessibility} />
             <StatBar label="特殊加成" value={scoreResult.breakdown.other.reduce((a,b)=>a+b.points,0)} color="bg-orange-500" icon={Star} />
           </div>

           {/* Details Log */}
           <div className="bg-slate-800/50 rounded-xl p-4 border border-white/5 max-h-60 overflow-y-auto custom-scrollbar">
             <h4 className="text-xs font-bold text-slate-500 mb-3 uppercase flex items-center gap-2">
               <FileText size={12}/> 得分詳情
             </h4>
             <div className="space-y-2">
               {[...scoreResult.breakdown.family, ...scoreResult.breakdown.age, ...scoreResult.breakdown.disability, ...scoreResult.breakdown.other].length > 0 ? (
                 [...scoreResult.breakdown.family, ...scoreResult.breakdown.age, ...scoreResult.breakdown.disability, ...scoreResult.breakdown.other].map((item, i) => (
                   <div key={i} className="flex justify-between text-xs items-center group hover:bg-white/5 p-1 rounded transition-colors">
                     <span className="text-slate-300 group-hover:text-white truncate max-w-[70%]">{item.label}</span>
                     <span className="text-yellow-400 font-bold bg-yellow-400/10 px-1.5 py-0.5 rounded">+{item.points}</span>
                   </div>
                 ))
               ) : (
                 <div className="text-center text-slate-600 text-xs py-4">尚未獲得分數</div>
               )}
             </div>
           </div>

           {/* Disclaimer */}
           <div className="mt-6 pt-4 border-t border-white/10 text-[10px] text-rose-300 text-center leading-relaxed opacity-80">
             ⚠️ 遊戲僅做教學與示意，實際資格以社會局正式審查為準。
           </div>
        </div>
      </div>
    </div>
  );
};

// RPG Components
const SkillCard = ({ label, point, active, onClick, icon: Icon, disabled, color="indigo" }) => (
  <button 
    onClick={!disabled ? onClick : undefined} 
    className={`relative p-3 rounded-xl border-2 text-left transition-all duration-200 w-full group
      ${disabled ? 'opacity-40 cursor-not-allowed border-slate-100 bg-slate-50' : 
        active ? `bg-${color}-50 border-${color}-500 shadow-md` : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'}
    `}
  >
    <div className="flex justify-between items-start mb-2">
      <Icon size={18} className={active ? `text-${color}-600` : 'text-slate-400'} />
      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${active ? `bg-${color}-200 text-${color}-800` : 'bg-slate-100 text-slate-500'}`}>+{point}</span>
    </div>
    <div className={`text-xs font-bold ${active ? `text-${color}-800` : 'text-slate-600'}`}>{label}</div>
  </button>
);

const CharacterCard = ({ data, onUpdate, onRemove, idx }) => (
  <div className="border-2 border-slate-200 rounded-2xl p-4 bg-white relative hover:border-indigo-400 hover:shadow-lg transition-all group">
    <div className="absolute -top-3 left-4 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">
      LV.{data.age || '?'}
    </div>
    <button onClick={() => onRemove(data.id)} className="absolute top-4 right-4 text-slate-300 hover:text-rose-500 transition-colors p-1">
      <Trash2 size={16}/>
    </button>

    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-4 pt-2">
      <div className="md:col-span-4">
        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Name</label>
        <input type="text" value={data.name} onChange={(e) => onUpdate(data.id, 'name', e.target.value)} className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm focus:border-indigo-500 outline-none font-bold text-slate-700"/>
      </div>
      <div className="md:col-span-3">
        <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Age</label>
        <input type="number" value={data.age} onChange={(e) => onUpdate(data.id, 'age', e.target.value)} className="w-full p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm focus:border-indigo-500 outline-none" placeholder="0"/>
      </div>
      <div className="md:col-span-5 flex items-center pb-2">
         <label className={`flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-lg border transition-colors ${data.isIndigenous ? 'bg-orange-50 border-orange-200 text-orange-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            <input type="checkbox" checked={data.isIndigenous} onChange={(e) => onUpdate(data.id, 'isIndigenous', e.target.checked)} className="hidden"/>
            {data.isIndigenous ? <CheckCircle2 size={14}/> : <div className="w-3.5 h-3.5 border rounded-full border-slate-300"></div>}
            <span className="text-xs font-bold">原住民身分</span>
         </label>
      </div>
    </div>

    <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
      <div className="text-[10px] font-bold text-slate-400 mb-2 uppercase flex items-center gap-1"><Zap size={10}/> 被動技能 (身分標籤)</div>
      <div className="space-y-3">
        <select value={data.disabilityLevel} onChange={(e) => onUpdate(data.id, 'disabilityLevel', e.target.value)} className="w-full p-2 rounded-lg border border-slate-200 text-xs bg-white focus:border-indigo-500 outline-none">
          <option value="none">無身心障礙證明</option>
          <option value="mild_mod">輕度、中度身障 (+5)</option>
          <option value="severe">重度、極重度身障 (+7)</option>
        </select>
        <div className="flex flex-wrap gap-2">
          <TagCheck label="特定障礙(+10)" checked={data.specialDisability} onChange={(v) => onUpdate(data.id, 'specialDisability', v)} tip="自閉/肢體/智能/精障"/>
          <TagCheck label="失能(+5)" checked={data.isIncapable} onChange={(v) => onUpdate(data.id, 'isIncapable', v)} />
          <TagCheck label="愛滋(+3)" checked={data.isHIV} onChange={(v) => onUpdate(data.id, 'isHIV', v)} />
          <TagCheck label="街友(+3)" checked={data.isHomeless} onChange={(v) => onUpdate(data.id, 'isHomeless', v)} />
          <TagCheck label="結束安置(+3)" checked={data.isFosterEnd} onChange={(v) => onUpdate(data.id, 'isFosterEnd', v)} />
        </div>
      </div>
    </div>
  </div>
);

const TagCheck = ({ label, checked, onChange, tip }) => (
  <label className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer transition-all text-[10px] font-bold ${checked ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`} title={tip}>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="hidden"/>
    {checked ? <CheckCircle size={10}/> : <div className="w-2.5 h-2.5 rounded-full border border-slate-300"></div>}
    <span>{label}</span>
  </label>
);

const StatBar = ({ label, value, color, icon: Icon }) => (
  <div className="group">
    <div className="flex justify-between items-end mb-1">
      <span className="text-xs text-slate-400 flex items-center gap-1.5"><Icon size={12}/> {label}</span>
      <span className={`text-sm font-bold ${value > 0 ? 'text-white' : 'text-slate-600'}`}>{value}</span>
    </div>
    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${Math.min(value * 2, 100)}%` }}></div>
    </div>
  </div>
);

// ==========================================
// 2-1. 社宅弱勢 View (整合儀表板與遊戲)
// ==========================================
const SocialHousingVulnerabilityView = () => {
  const [subTab, setSubTab] = useState('dashboard');
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
           <div className="w-1.5 h-8 bg-indigo-500"></div>
           <h2 className="text-2xl font-bold text-slate-800">社宅弱勢主題</h2>
        </div>
        
        <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm flex">
          <button onClick={() => setSubTab('dashboard')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${subTab === 'dashboard' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <BarChart3 size={16}/> 數據儀表板
          </button>
          <button onClick={() => setSubTab('game')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${subTab === 'game' ? 'bg-rose-50 text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Sword size={16}/> 評點試算 RPG
          </button>
        </div>
      </div>
      {subTab === 'dashboard' ? <SocialHousingDashboard /> : <SocialHousingScoringGame />}
    </div>
  );
};

// ==========================================
// 社宅弱勢儀表板 (大幅升級)
// ==========================================
const SocialHousingDashboard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 篩選器狀態: 預設為空
  const [selectedSites, setSelectedSites] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef(null);

  const VULNERABLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTT-_7yLlXfL46QQFLCIwHKEEcBvBuWNiFAsz5KiyLgAuyI7Ur-UFuf_fC5-uzMSfsivZZ1m_ySEDZe/pub?gid=1272555717&single=true&output=csv';

  // 使用 AA 欄位 (Index 26) 計算年齡
  const FIXED_INDICES = {
    siteName: 0,    // A欄
    houseNo: 25,    // Z欄
    elderly: 12,    // M欄
    disability: 7,  // H欄
    welfare: 11,    // L欄
    disType: 9,     // J欄
    age: 26         // AA欄 (年齡)
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await fetch(VULNERABLE_SHEET_URL).then(r => r.text());
        const parsed = parseData(res);
        setData(parsed);
      } catch (error) {
        console.error("Error fetching vulnerable data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // 取得社宅清單 (移除最後4個非社宅項目)
  const allSites = useMemo(() => {
    if (data.length === 0) return [];
    const sites = new Set();
    data.forEach(row => {
      let name = row._raw && row._raw[FIXED_INDICES.siteName];
      if (name) sites.add(String(name).trim());
    });
    // 排序後移除最後4個
    return Array.from(sites).sort().slice(0, -4);
  }, [data]);

  const toggleSite = (site) => {
    setSelectedSites(prev => prev.includes(site) ? prev.filter(s => s !== site) : [...prev, site]);
  };

  const handleSelectAll = () => setSelectedSites(allSites);
  const handleClearAll = () => setSelectedSites([]);

  // 過濾數據: 
  // 修改：搜尋僅過濾選項，數據呈現只看勾選狀態。若無勾選則顯示全部。
  const filteredData = useMemo(() => {
    if (data.length === 0) return [];
    
    // 若無勾選任何社宅，則回傳全部資料 (預設狀態)
    if (selectedSites.length === 0) return data; 

    // 回傳勾選的社宅
    return data.filter(row => {
      let name = row._raw && row._raw[FIXED_INDICES.siteName];
      return name && selectedSites.includes(String(name).trim());
    });
  }, [data, selectedSites]); 

  const stats = useMemo(() => {
    const emptyStats = {
      totalPeople: 0, totalHouse: 0,
      elderly: { people: 0, house: 0 },
      disability: { people: 0, house: 0 },
      lowIncome: { people: 0, house: 0 },
      midLow: { people: 0, house: 0 },
      charts: { lowIncome: [], disability: [], top10Elderly: [], top10Disability: [], ageStructure: [] }
    };

    if (filteredData.length === 0) return emptyStats;

    // Sets for unique house counting
    const setTotalHouse = new Set();
    const setElderlyHouse = new Set();
    const setDisabilityHouse = new Set();
    const setLowIncomeHouse = new Set();
    const setMidLowHouse = new Set();

    let countTotalPeople = 0;
    let countElderlyPeople = 0;
    let countDisabilityPeople = 0;
    let countLowIncomePeople = 0;
    let countMidLowPeople = 0;

    const lowIncomeTypeMap = {}; 
    const disTypeMap = {};
    const siteElderlyMap = {};
    const siteDisabilityMap = {};
    
    // Age Groups (包含 0歲, 1歲)
    const ageGroups = { '0歲': 0, '1歲': 0, '0-18歲': 0, '19-64歲': 0, '65歲以上': 0 };

    filteredData.forEach(row => {
      const getValue = (idx) => {
        if (row._raw && row._raw[idx] !== undefined) return String(row._raw[idx]).trim();
        return '';
      };

      const siteName = getValue(FIXED_INDICES.siteName);
      const houseNo = getValue(FIXED_INDICES.houseNo);
      const valElderly = getValue(FIXED_INDICES.elderly);
      const valDisability = getValue(FIXED_INDICES.disability);
      const valWelfare = getValue(FIXED_INDICES.welfare);
      const valDisType = getValue(FIXED_INDICES.disType);
      const valAge = getValue(FIXED_INDICES.age); // AA欄

      // 全體
      countTotalPeople++;
      if (houseNo) setTotalHouse.add(houseNo);

      // 獨老
      if (valElderly === '是' || valElderly === 'V') {
        countElderlyPeople++;
        if (houseNo) setElderlyHouse.add(houseNo);
        if (siteName) siteElderlyMap[siteName] = (siteElderlyMap[siteName] || 0) + 1;
      }

      // 身障
      if (valDisability === 'V' || valDisability === '是') {
        countDisabilityPeople++;
        if (houseNo) setDisabilityHouse.add(houseNo);
        if (valDisType) disTypeMap[valDisType] = (disTypeMap[valDisType] || 0) + 1;
        if (siteName) siteDisabilityMap[siteName] = (siteDisabilityMap[siteName] || 0) + 1;
      }

      // 福利身分
      if (valWelfare.includes('中低收')) {
        countMidLowPeople++;
        if (houseNo) setMidLowHouse.add(houseNo);
      } else if (
          ['0類', '1類', '2類', '3類', '4類'].some(t => valWelfare.includes(t)) || 
          valWelfare.match(/[0-4]類/) || valWelfare.match(/^[0-4]$/)
      ) {
        countLowIncomePeople++;
        if (houseNo) setLowIncomeHouse.add(houseNo);
        const match = valWelfare.match(/[0-4]類/) || valWelfare.match(/[0-4]/);
        if (match) {
           let type = match[0];
           if (type.match(/^[0-4]$/)) type = type + "類";
           if (!lowIncomeTypeMap[type]) lowIncomeTypeMap[type] = new Set();
           if (houseNo) lowIncomeTypeMap[type].add(houseNo);
        }
      }
      
      // Age Calculation (使用 AA 欄位)
      const age = parseInt(valAge.replace(/[^0-9]/g, '')) || 0;
      if (valAge !== '') { // 確保有值
          if (age === 0) ageGroups['0歲']++;
          if (age === 1) ageGroups['1歲']++;
          
          if (age <= 18) ageGroups['0-18歲']++;
          else if (age < 65) ageGroups['19-64歲']++;
          else ageGroups['65歲以上']++;
      }
    });

    const lowIncomeChartData = Object.entries(lowIncomeTypeMap).map(([name, set]) => ({ name, value: set.size })).sort((a, b) => a.name.localeCompare(b.name));
    const totalLowIncomeHouseForChart = lowIncomeChartData.reduce((acc, c) => acc + c.value, 0);
    lowIncomeChartData.forEach(d => {
      d.percent = totalLowIncomeHouseForChart > 0 ? ((d.value / totalLowIncomeHouseForChart) * 100).toFixed(1) + '%' : '0%';
      d.label = `${d.value}戶 (${d.percent})`;
    });

    const disChartData = Object.entries(disTypeMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value); 
    const totalDisPeople = disChartData.reduce((acc, c) => acc + c.value, 0);
    disChartData.forEach(d => {
      d.percent = totalDisPeople > 0 ? ((d.value / totalDisPeople) * 100).toFixed(1) + '%' : '0%';
      d.label = `${d.value}人 (${d.percent})`;
    });

    const getTop10 = (map) => Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
    const top10Elderly = getTop10(siteElderlyMap);
    const top10Disability = getTop10(siteDisabilityMap);
    
    // Age Chart Data
    const ageChartData = [
       { name: '0-18歲', value: ageGroups['0-18歲'], color: '#10B981' }, 
       { name: '19-64歲', value: ageGroups['19-64歲'], color: '#3B82F6' },
       { name: '65歲以上', value: ageGroups['65歲以上'], color: '#F59E0B' },
    ].filter(d => d.value > 0);

    // Pass detailed 0/1 stats separately
    const infantStats = { age0: ageGroups['0歲'], age1: ageGroups['1歲'] };

    return {
      totalPeople: countTotalPeople,
      totalHouse: setTotalHouse.size,
      elderly: { people: countElderlyPeople, house: setElderlyHouse.size },
      disability: { people: countDisabilityPeople, house: setDisabilityHouse.size },
      lowIncome: { people: countLowIncomePeople, house: setLowIncomeHouse.size },
      midLow: { people: countMidLowPeople, house: setMidLowHouse.size },
      charts: { lowIncome: lowIncomeChartData, disability: disChartData, top10Elderly, top10Disability, ageStructure: ageChartData },
      infantStats
    };
  }, [filteredData]);

  if (loading) return <div className="flex h-96 items-center justify-center text-slate-400"><Loader2 className="animate-spin mr-2"/> 載入數據中...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* 頂部總覽條 + 篩選器 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
         <div className="flex gap-6">
            <div className="flex items-center gap-2">
               <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><User size={20}/></div>
               <div>
                 <p className="text-xs text-slate-400">現住戶總人數</p>
                 <p className="text-xl font-bold text-slate-700">{stats.totalPeople}</p>
               </div>
            </div>
            <div className="w-px h-10 bg-slate-100"></div>
            <div className="flex items-center gap-2">
               <div className="p-2 bg-teal-50 text-teal-600 rounded-lg"><Home size={20}/></div>
               <div>
                 <p className="text-xs text-slate-400">現住戶總戶數</p>
                 <p className="text-xl font-bold text-slate-700">{stats.totalHouse}</p>
               </div>
            </div>
         </div>

         {/* 篩選按鈕 */}
         <div className="relative" ref={filterRef}>
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition-colors ${selectedSites.length > 0 ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            >
              <Filter size={16}/>
              <span>
                {selectedSites.length === 0 ? '全部社宅 (預設)' : 
                 selectedSites.length === allSites.length ? '全部社宅' : 
                 `已選 ${selectedSites.length} 處社宅`}
              </span>
              <ChevronDown size={16}/>
            </button>

            {isFilterOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-slate-100 rounded-xl shadow-xl z-50 p-4">
                 <div className="mb-3 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
                    <input 
                      type="text" 
                      placeholder="搜尋社宅..." 
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                 </div>
                 <div className="flex gap-2 mb-3">
                    <button onClick={handleSelectAll} className="flex-1 text-xs bg-blue-50 text-blue-600 py-1.5 rounded hover:bg-blue-100">全選</button>
                    <button onClick={handleClearAll} className="flex-1 text-xs bg-slate-50 text-slate-600 py-1.5 rounded hover:bg-slate-100">取消全選</button>
                 </div>
                 <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                    {allSites.filter(s => s.includes(searchTerm)).map(site => (
                      <label key={site} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer text-sm">
                        <div className={`w-5 h-5 border rounded flex items-center justify-center transition-colors ${selectedSites.includes(site) ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300 bg-white'}`}>
                           {selectedSites.includes(site) && <CheckCircle2 size={14}/>}
                        </div>
                        <input type="checkbox" className="hidden" checked={selectedSites.includes(site)} onChange={() => toggleSite(site)} />
                        <span className="text-slate-700 truncate flex-1">{site}</span>
                      </label>
                    ))}
                    {allSites.filter(s => s.includes(searchTerm)).length === 0 && (
                      <div className="text-center text-slate-400 text-xs py-4">無符合社宅</div>
                    )}
                 </div>
              </div>
            )}
         </div>
      </div>

      {/* 4張主要圖卡 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="列冊獨居長者" people={stats.elderly.people} house={stats.elderly.house} totalPeople={stats.totalPeople} totalHouse={stats.totalHouse} colorClass="bg-amber-500" icon={User} />
        <StatCard title="身心障礙者" people={stats.disability.people} house={stats.disability.house} totalPeople={stats.totalPeople} totalHouse={stats.totalHouse} colorClass="bg-rose-500" icon={Accessibility} />
        <StatCard title="低收入戶" people={stats.lowIncome.people} house={stats.lowIncome.house} totalPeople={stats.totalPeople} totalHouse={stats.totalHouse} colorClass="bg-blue-500" icon={HeartHandshake} />
        <StatCard title="中低收入戶" people={stats.midLow.people} house={stats.midLow.house} totalPeople={stats.totalPeople} totalHouse={stats.totalHouse} colorClass="bg-teal-500" icon={Target} />
      </div>
      
      {/* 新增：年齡結構分析 */}
      <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
         <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg"><UserPlus size={20}/></div>
            <h3 className="text-lg font-bold text-slate-700">社宅人口年齡結構分析</h3>
         </div>
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
            <div className="h-[300px] col-span-2">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                    <Pie 
                      data={stats.charts.ageStructure} 
                      cx="50%" cy="50%" 
                      innerRadius={60} 
                      outerRadius={100} 
                      paddingAngle={2} 
                      dataKey="value"
                    >
                      {stats.charts.ageStructure.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val) => [`${val}人`, '人數']} />
                    <Legend verticalAlign="middle" align="right" layout="vertical"/>
                 </PieChart>
               </ResponsiveContainer>
            </div>
            <div className="bg-indigo-50 rounded-2xl p-6">
               <h4 className="text-indigo-900 font-bold mb-4">65歲以上長者概況</h4>
               <div className="text-4xl font-bold text-indigo-600 mb-2">
                  {stats.totalPeople > 0 ? ((stats.charts.ageStructure.find(d => d.name === '65歲以上')?.value || 0) / stats.totalPeople * 100).toFixed(1) : 0}%
               </div>
               <p className="text-sm text-indigo-400 mb-6">佔全體社宅人口比例</p>
               <div className="space-y-3">
                  <div className="flex justify-between text-sm border-b border-indigo-100 pb-2">
                     <span className="text-slate-500">長者總人數</span>
                     <span className="font-bold text-slate-700">{stats.charts.ageStructure.find(d => d.name === '65歲以上')?.value || 0} 人</span>
                  </div>
                  <div className="flex justify-between text-sm border-b border-indigo-100 pb-2">
                     <span className="text-slate-500">0歲 幼兒</span>
                     <span className="font-bold text-rose-500">{stats.infantStats.age0} 人</span>
                  </div>
                  <div className="flex justify-between text-sm">
                     <span className="text-slate-500">1歲 幼兒</span>
                     <span className="font-bold text-rose-500">{stats.infantStats.age1} 人</span>
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* 圖表區 Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
             <div className="p-2 bg-blue-50 text-blue-500 rounded-lg"><BarChart3 size={20}/></div>
             <h3 className="text-lg font-bold text-slate-700">低收入戶類別結構 (0-4類)</h3>
          </div>
          <div className="h-[350px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={stats.charts.lowIncome} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                 <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0"/>
                 <XAxis type="number" hide />
                 <YAxis dataKey="name" type="category" width={50} tick={{fontSize: 12, fill: '#64748b'}} />
                 <Tooltip cursor={{fill: '#f8fafc'}} formatter={(value) => [value, '戶數']} />
                 <Bar dataKey="value" fill="#3B82F6" radius={[0, 4, 4, 0]} barSize={30}>
                    <LabelList dataKey="label" position="right" fill="#64748b" fontSize={12} />
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
          </div>
          <p className="text-center text-xs text-slate-400 mt-2">* 統計單位：戶數 (排除重複戶號)</p>
        </div>

        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
             <div className="p-2 bg-rose-50 text-rose-500 rounded-lg"><PieChartIcon size={20}/></div>
             <h3 className="text-lg font-bold text-slate-700">身心障礙類別統計</h3>
          </div>
          <div className="h-[350px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={stats.charts.disability} layout="vertical" margin={{ top: 5, right: 80, left: 20, bottom: 5 }}>
                 <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0"/>
                 <XAxis type="number" hide />
                 <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 11, fill: '#64748b'}} interval={0} />
                 <Tooltip cursor={{fill: '#f8fafc'}} formatter={(value) => [value, '人數']} />
                 <Bar dataKey="value" fill="#F43F5E" radius={[0, 4, 4, 0]} barSize={20}>
                    <LabelList dataKey="label" position="right" fill="#64748b" fontSize={11} />
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
          </div>
          <p className="text-center text-xs text-slate-400 mt-2">* 統計單位：人數</p>
        </div>
      </div>

      {/* 圖表區 Row 2: Top 10 分析 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
               <div className="p-2 bg-amber-50 text-amber-500 rounded-lg"><TrendingUp size={20}/></div>
               <h3 className="text-lg font-bold text-slate-700">獨居長者人數 Top 10 社宅</h3>
            </div>
            <div className="h-[350px]">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={stats.charts.top10Elderly} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                   <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0"/>
                   <XAxis type="number" hide />
                   <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fill: '#64748b'}} interval={0}/>
                   <Tooltip cursor={{fill: '#f8fafc'}} formatter={(value) => [value, '人數']} />
                   <Bar dataKey="value" fill="#F59E0B" radius={[0, 4, 4, 0]} barSize={20}>
                      <LabelList dataKey="value" position="right" fill="#64748b" fontSize={12} formatter={(val)=>`${val}人`}/>
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-6">
               <div className="p-2 bg-rose-50 text-rose-500 rounded-lg"><TrendingUp size={20}/></div>
               <h3 className="text-lg font-bold text-slate-700">身心障礙人數 Top 10 社宅</h3>
            </div>
            <div className="h-[350px]">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={stats.charts.top10Disability} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                   <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0"/>
                   <XAxis type="number" hide />
                   <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fill: '#64748b'}} interval={0}/>
                   <Tooltip cursor={{fill: '#f8fafc'}} formatter={(value) => [value, '人數']} />
                   <Bar dataKey="value" fill="#EC4899" radius={[0, 4, 4, 0]} barSize={20}>
                      <LabelList dataKey="value" position="right" fill="#64748b" fontSize={12} formatter={(val)=>`${val}人`}/>
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
            </div>
         </div>
      </div>

    </div>
  );
};

// ==========================================
// 3. 主框架 (Main Layout)
// ==========================================

const Sidebar = ({ activeTab, setActiveTab, isOpen, setIsOpen }) => {
  const menuItems = [
    { id: 'welfare', label: '社福設施概況', icon: Building2 },
    { id: 'housing', label: '社宅弱勢主題', icon: Users },
  ];

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/20 z-20 lg:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      />
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-100 z-30 transform transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-50 flex flex-col items-center gap-4 text-center">
          {/* Logo 區域 (純透明底、84px) */}
          <div className="w-[84px] h-[84px] flex items-center justify-center overflow-visible mb-[-12px]">
             <img 
               src="綜合規劃股儀表板logo.jpg" 
               alt="綜合規劃股"
               className="w-full h-full object-contain mix-blend-multiply"
             />
          </div>
          <div>
             <h1 className="font-bold text-slate-800 text-lg leading-tight">綜合規劃股<br/>業務儀表板</h1>
          </div>
          <button className="lg:hidden absolute top-4 right-4 text-slate-400" onClick={() => setIsOpen(false)}>
             <X size={20} />
          </button>
        </div>

        <nav className="p-4 space-y-2">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setIsOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-slate-800 text-white shadow-md shadow-slate-200' 
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full p-6 text-xs text-slate-300 text-center border-t border-slate-50">
           Taipei City Government<br/>Social Welfare Dashboard
        </div>
      </aside>
    </>
  );
};

// 小遊戲用的子元件
const StatCard = ({ title, subTitle, people, house, totalPeople, totalHouse, colorClass, icon: Icon }) => {
  const percentPeople = totalPeople > 0 ? ((people / totalPeople) * 100).toFixed(1) : 0;
  const percentHouse = totalHouse > 0 ? ((house / totalHouse) * 100).toFixed(1) : 0;
  
  return (
    <div className={`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-5 relative overflow-hidden`}>
       <div className={`absolute right-0 top-0 w-24 h-24 ${colorClass} opacity-5 rounded-bl-full`}></div>
       <div className={`w-14 h-14 rounded-full ${colorClass.replace('bg-', 'bg-').replace('500', '100')} flex items-center justify-center ${colorClass.replace('bg-', 'text-')}`}>
         <Icon size={28} />
       </div>
       <div className="flex-1">
         <p className="text-sm text-slate-500 font-medium mb-1">{title}</p>
         <div className="flex items-baseline gap-2 mb-2">
            <span className="text-3xl font-bold text-slate-800">{people}</span>
            <span className="text-xs font-medium text-slate-400">人</span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${colorClass.replace('bg-', 'bg-').replace('500', '100')} ${colorClass.replace('bg-', 'text-').replace('500', '600')}`}>
               {percentPeople}%
            </span>
         </div>
         <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
            <span className="text-xs text-slate-400">對應戶數</span>
            <div className="flex items-center gap-1.5">
               <span className="text-sm font-semibold text-slate-600">{house} 戶</span>
               <span className="text-[10px] text-slate-400 bg-slate-50 px-1 rounded">
                 佔{percentHouse}%
               </span>
            </div>
         </div>
       </div>
    </div>
  );
};

const App = () => {
  const [activeTab, setActiveTab] = useState('welfare'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      
      <div className="flex-1 lg:ml-64 min-h-screen flex flex-col">
         <div className="lg:hidden bg-white px-4 py-3 flex items-center gap-3 border-b border-slate-100 sticky top-0 z-10">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-500">
               <Menu size={24}/>
            </button>
            <span className="font-bold text-slate-700">綜合規劃股業務儀表板</span>
         </div>
         <main className="flex-1 p-6 lg:p-10 max-w-[1600px] mx-auto w-full">
            {activeTab === 'welfare' && <SocialWelfareView />}
            {activeTab === 'housing' && <SocialHousingVulnerabilityView />}
         </main>
      </div>
    </div>
  );
};

export default App;
