import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Building2, 
  FileText, 
  CheckCircle2, 
  CheckCircle, 
  Layout, 
  Home,
  Search,
  User,
  Loader2,
  ChevronDown,
  Baby,
  TrendingUp,
  AlertTriangle,
  Target,
  Info,
  Smartphone,
  Sun,
  Moon,
  X
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, 
  LineChart, Line, BarChart, Bar, ComposedChart, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, LabelList
} from 'recharts';

// --- 輔助函式：數值解析 (移除千分位逗號) ---
const parseNumber = (v) => {
  if (!v) return 0;
  const str = String(v).replace(/,/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
};

// --- 輔助函式：行政區名稱正規化 ---
const normalizeDistrict = (name) => {
  if (!name) return '';
  return String(name)
    .trim()
    .replace(/臺/g, '台')        // 統一臺/台
    .replace(/^台北市/, '')      // 移除開頭的台北市
    .replace(/^台彎省/, '')      // 移除罕見前綴
    .replace(/\s+/g, '')         // 去除空白
    .replace(/區$/, '');         // 去掉「區」字
};

// --- 通用解析器 (支援 CSV 與 TSV) ---
const parseData = (text, headerKeyword = null) => {
  if (!text) return [];
  let lines = text.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) return [];

  // 自動偵測分隔符號
  let separator = lines[0].includes('\t') ? '\t' : ',';

  // 若有指定 headerKeyword，則尋找包含該關鍵字的行作為開頭
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
    const entry = {};
    headers.forEach((header, index) => {
      const cleanHeader = header.replace(/^\uFEFF/, '').trim();
      if (cleanHeader) {
        entry[cleanHeader] = values[index] || '';
      }
    });
    return entry;
  });
};

// --- 專用解析器：人口資料 (Population) ---
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

    // 強制附加 H 欄數據 (未來人口, Index 7)
    if (cols.length > 7) {
        entry['raw_col_h'] = cols[7];
    }

    return entry;
  });
};

// --- 特殊解析器：讀取特定儲存格 (B15) ---
const parseCellB15 = (text) => {
  if (!text) return 0;
  const lines = text.split('\n');
  if (lines.length < 15) return 0; 
  const line15 = lines[14]; 
  const separator = line15.includes('\t') ? '\t' : ',';
  const cols = line15.split(separator);
  if (cols.length > 1) {
    return parseNumber(cols[1].replace(/^"|"$/g, ''));
  }
  return 0;
};

// 色彩常數
const COLORS = {
  targets: ['#F97316', '#14B8A6', '#EC4899', '#8B5CF6', '#3B82F6', '#EAB308', '#EF4444', '#6366F1']
};

const App = () => {
  // --- 狀態管理 ---
  const [csvData, setCsvData] = useState([]); 
  const [popData, setPopData] = useState([]);
  const [childcareNowData, setChildcareNowData] = useState([]);
  const [childcareFutureData, setChildcareFutureData] = useState([]);
  const [telecomData, setTelecomData] = useState([]); 
  const [popFutureTotal, setPopFutureTotal] = useState(0); 

  const [loading, setLoading] = useState(true);
  const [pmSearchTerm, setPmSearchTerm] = useState('');
  const [selectedBase, setSelectedBase] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // 用於點擊外部關閉下拉選單
  const dropdownRef = useRef(null);

  // 監聽點擊事件，若點擊在 dropdownRef 外部則關閉選單
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

  const handleSelectBase = (item) => {
    setPmSearchTerm(item.baseName);
    setSelectedBase(item);
    setIsDropdownOpen(false);
  };

  const toggleDropdown = () => {
    if (!isDropdownOpen) {
      setPmSearchTerm(''); // 清除篩選，顯示全部
    }
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
        
        // [118年推估]
        const POP_FUTURE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=1074300767&single=true&output=csv';
        // [電信信令]
        const TELECOM_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=1894885880&single=true&output=csv';

        const [resMain, resPop, resNow, resFuture, resPopFut, resTelecom] = await Promise.all([
          fetch(MAIN_SHEET_URL).then(r => r.text()),
          fetch(POPULATION_URL).then(r => r.text()),
          fetch(CHILDCARE_NOW_URL).then(r => r.text()),
          fetch(CHILDCARE_FUTURE_URL).then(r => r.text()),
          fetch(POP_FUTURE_URL).then(r => r.text()),
          fetch(TELECOM_URL).then(r => r.text())
        ]);

        setCsvData(parseData(resMain));
        setPopData(parsePopulationData(resPop)); // 使用 H 欄解析器
        setChildcareNowData(parseData(resNow));
        setChildcareFutureData(parseData(resFuture));
        
        // 解析 B15 取得 118 年 0-1 歲推估總數
        const pFuture = parseCellB15(resPopFut);
        setPopFutureTotal(pFuture);

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
        rawFacType,              
        facType,                  
        type: row[colType],
        district: row[colDistrict],
        baseName: row[colBase],
        startYear: parseInt(row[colStartYear]) || null,
        status,
        acqMethod: row[colAcqMethod],
        pmName: row[colPM]
      };
    });
  }, [csvData]);

  // 下拉選單過濾：排除 PM 為空白的項目
  const baseList = useMemo(() => {
    return processedData
      .filter(item => 
        item.baseName && item.baseName.trim() !== '' && 
        item.pmName && item.pmName.trim() !== '' 
      )
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
        if ((item.status === '已結束' || item.status === '已撤點') && item.endYear && year > item.endYear) {
           hasEnded = true;
        }
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

  // --- ⭐ NEW: 公托覆蓋率與缺口分析邏輯 ---
  
  const { districtSummary, cityStats, cumulativeTrend } = useMemo(() => {
    if (popData.length === 0 && childcareNowData.length === 0) return { districtSummary: [], cityStats: {}, cumulativeTrend: [] };

    const getVal = (obj, keywords) => {
      const k = Object.keys(obj).find(k => keywords.some(w => k.includes(w)));
      return k ? parseNumber(obj[k]) : 0;
    };
    const getStr = (obj, keywords) => {
      const k = Object.keys(obj).find(k => keywords.some(w => k.includes(w)));
      return k && obj[k] ? String(obj[k]).trim() : '';
    };

    const districtMap = {};

    // A. 處理 Population (現況 0-1 歲總和)
    popData.forEach(row => {
      const rawDist = getStr(row, ['行政區', '區別', '區']);
      if (!rawDist || rawDist.includes('總計') || rawDist.includes('單位') || rawDist.includes('合計')) return;
      const normDist = normalizeDistrict(rawDist);
      if (!normDist) return;

      const pop0 = getVal(row, ['0歲', '0 歲', '零歲']);
      const pop1 = getVal(row, ['1歲', '1 歲', '一歲']);
      const totalPop0to1 = pop0 + pop1;
      
      // [修正] 直接取用 H 欄 (Index 7) 作為未來人口
      const popFuture = parseNumber(row['raw_col_h']);

      if (!districtMap[normDist]) {
        districtMap[normDist] = { 
          district: rawDist, 
          popNow: 0, 
          popFuture: 0,
          capacityNow: 0, 
          futureCapacity: 0,
          telecom: { day: 0, night: 0 }
        };
      }
      districtMap[normDist].popNow += totalPop0to1;
      districtMap[normDist].popFuture += popFuture; // 累加 H 欄
    });

    // B. 處理 Childcare Now
    let cityCapacityNow = 0;
    childcareNowData.forEach(row => {
      const rawDist = getStr(row, ['行政區', '區別', '區']);
      // 排除可能出現的總計列
      if (!rawDist || rawDist.includes('總計') || rawDist.includes('合計')) return;
      
      const normDist = normalizeDistrict(rawDist);
      const cap = getVal(row, ['收托人數', '收托', '容量']);
      
      if (cap > 0) {
        cityCapacityNow += cap;
        if (districtMap[normDist]) {
          districtMap[normDist].capacityNow += cap;
        } else {
          const d = districtMap[normDist + '區'] ? normDist + '區' : null;
          if (d) districtMap[d].capacityNow += cap;
        }
      }
    });

    // C. 處理 Telecom Data
    telecomData.forEach(row => {
      const rawDist = getStr(row, ['行政區', '區別']);
      const normDist = normalizeDistrict(rawDist);
      if (districtMap[normDist]) {
        districtMap[normDist].telecom.night = getVal(row, ['夜間', '停留']);
        districtMap[normDist].telecom.day = getVal(row, ['日間活動', '日間']);
      }
    });

    // D. 處理 Childcare Future (與計算趨勢)
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
        if (districtMap[normDist]) {
          districtMap[normDist].futureCapacity += cap;
        }
        // 累積趨勢計算
        if (year >= 114 && year <= 118) {
          futureByYear[year] = (futureByYear[year] || 0) + cap;
        }
      }
    });

    // 目標 10%
    const TARGET_COVERAGE_RATE = 0.10; 

    // F. 彙整各區指標
    const results = Object.values(districtMap).map(d => {
      const displayName = d.district.endsWith('區') ? d.district : d.district + '區';

      // 現況
      const coverageNow = d.popNow > 0 ? (d.capacityNow / d.popNow) : 0;
      
      // 未來推估 (直接使用 H 欄數據，不再計算倍率)
      const futurePop = d.popFuture > 0 ? d.popFuture : d.popNow; // 防呆
      
      const capacityFutureTotal = d.capacityNow + d.futureCapacity;
      const coverageFuture = futurePop > 0 ? (capacityFutureTotal / futurePop) : 0;

      // 缺口
      const gapNow = Math.max(0, (d.popNow * TARGET_COVERAGE_RATE) - d.capacityNow);
      const gapFuture = Math.max(0, (futurePop * TARGET_COVERAGE_RATE) - capacityFutureTotal);

      const dayNightRatio = d.telecom.night > 0 ? (d.telecom.day / d.telecom.night) : 1;

      // 排序分數
      const priorityScore = gapFuture + (gapNow * 0.5); 

      return {
        district: displayName,
        popNow: d.popNow,
        capacityNow: d.capacityNow,
        futurePop,
        capacityFutureTotal,
        coverageNow,
        coverageFuture,
        gapNow,
        gapFuture,
        dayNightRatio,
        priorityScore
      };
    });

    // G. 計算趨勢圖數據 (114-118)
    const trendArr = [];
    let cumulativeCap = cityCapacityNow;
    trendArr.push({ year: '113(基期)', capacity: cumulativeCap });
    for (let y = 114; y <= 118; y++) {
      const added = futureByYear[y] || 0;
      cumulativeCap += added;
      trendArr.push({ year: `${y}年`, capacity: cumulativeCap, added });
    }

    return { 
      districtSummary: results.sort((a, b) => b.priorityScore - a.priorityScore),
      cityStats: { 
        coverageNow: Object.values(districtMap).reduce((acc, curr) => acc + curr.popNow, 0) > 0 
          ? cityCapacityNow / Object.values(districtMap).reduce((acc, curr) => acc + curr.popNow, 0) 
          : 0, 
        capNow: cityCapacityNow,
        popNow: Object.values(districtMap).reduce((acc, curr) => acc + curr.popNow, 0)
      },
      cumulativeTrend: trendArr
    };
  }, [popData, childcareNowData, childcareFutureData, telecomData]);

  const chartData = useMemo(() => {
    return [...districtSummary].sort((a, b) => a.district.localeCompare(b.district)); 
  }, [districtSummary]);

  const priorityList = useMemo(() => districtSummary.slice(0, 6), [districtSummary]);

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

  return (
    <div className="min-h-screen bg-orange-50/30 font-sans text-slate-800 pb-20">
      <Header />

      <main className="max-w-[1600px] mx-auto px-8 pt-10 space-y-12">

        {/* --- 第一區塊：基地大樓 PM 查詢 --- */}
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
            {/* ...其他三張卡片... */}
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

        {/* --- 第三區塊：委外設施數量成長趨勢 --- */}
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
            <p className="text-center text-xs text-slate-400 mt-4">* 包含公辦民營(勞務)、公辦民營(委營)、方案委託(帶地投標)之有效存續設施</p>
          </div>
        </section>

        {/* --- 第四區塊：社宅參建 | 福利設施開箱 --- */}
        <section>
          <SectionTitle title="社宅參建 | 福利設施開箱" colorClass="bg-teal-500" icon={Building2} />
          
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[500px]">
              <h3 className="text-lg font-medium text-slate-600 mb-8">服務對象佔比 (社宅參建)</h3>
              <div className="relative w-full h-[300px]">
                {housingPieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={housingPieData}
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                      >
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
                                      fac.status === '已開辦' 
                                        ? 'bg-emerald-100 text-emerald-700' 
                                        : 'bg-rose-100 text-rose-700'
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
                   <AreaChart data={cumulativeTrend} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                     <defs>
                       <linearGradient id="colorCap" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#F97316" stopOpacity={0.1}/>
                         <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <XAxis dataKey="year" tick={{fill: '#94a3b8', fontSize: 12}} />
                     {/* Y軸自動縮放：最小值減100作為基準，讓趨勢更明顯 */}
                     <YAxis 
                       domain={['dataMin - 100', 'auto']} 
                       tick={{fill: '#94a3b8', fontSize: 12}} 
                     />
                     <Tooltip 
                       contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                       formatter={(value) => [`${value}人`, '收托量']}
                     />
                     <Area type="monotone" dataKey="capacity" stroke="#F97316" strokeWidth={3} fillOpacity={1} fill="url(#colorCap)">
                        {/* 顯示折點數值 */}
                        <LabelList dataKey="capacity" position="top" fill="#F97316" fontSize={12} offset={5} />
                     </Area>
                   </AreaChart>
                 </ResponsiveContainer>
               </div>
             </div>

             <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col justify-center items-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-400 to-teal-400"></div>
                
                {/* Icon */}
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
            
            {/* (A) 左側：各行政區覆蓋率圖表 */}
            <div className="col-span-12 lg:col-span-8 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[500px]">
               <div className="flex justify-between items-start mb-6">
                 <div>
                   <h3 className="text-lg font-bold text-slate-700">各行政區公托覆蓋率</h3>
                   <div className="text-sm text-slate-500 mt-2 space-y-1">
                     <p>現況：以114年11月各區0-1歲幼兒人口為分母計算覆蓋率</p>
                     <p>布建後：以目標年度(118年)推估之各區0–1歲幼兒人口為分母計算覆蓋率</p>
                   </div>
                 </div>
               </div>

               <div className="h-[400px] w-full">
                 {chartData.length > 0 ? (
                   <ResponsiveContainer width="100%" height="100%">
                     <ComposedChart 
                        data={chartData} 
                        margin={{ top: 20, right: 20, bottom: 20, left: 10 }}
                        barGap={4}
                     >
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                       <XAxis dataKey="district" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                       <YAxis 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fill: '#64748b', fontSize: 12}} 
                          tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                       />
                       <Tooltip 
                          cursor={{fill: '#f8fafc'}}
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
                                    
                                    <hr className="border-slate-100"/>
                                    
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
                       {/* 10% 目標線 */}
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
               
               <div className="mt-4 flex items-center gap-2 text-xs text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <Info size={14} />
                  <span>人口資料來源：民政局</span>
               </div>
            </div>

            {/* (B) 右側：優先改善行政區清單 */}
            <div className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[500px] flex flex-col">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                  <AlertTriangle className="text-rose-500" size={20} />
                  優先改善行政區
                </h3>
                <p className="text-xs text-slate-400 mt-1">依據 10% 覆蓋目標之缺口規模與比例排序</p>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                 {priorityList.length > 0 ? (
                   priorityList.map((dist, idx) => {
                     // 判斷徽章
                     let badgeColor = "bg-green-100 text-green-700";
                     let badgeText = "達標";
                     
                     if (dist.coverageFuture < 0.05) {
                       badgeColor = "bg-rose-100 text-rose-700";
                       badgeText = "嚴重不足";
                     } else if (dist.coverageFuture < 0.10) {
                       badgeColor = "bg-orange-100 text-orange-700";
                       badgeText = "未達標";
                     }

                     // 電信標籤判斷
                     let telecomTag = "";
                     let telecomIcon = null;
                     if (dist.dayNightRatio >= 1.2) {
                       telecomTag = "通勤熱區";
                       telecomIcon = <Sun size={12} className="text-amber-500"/>;
                     } else if (dist.dayNightRatio < 0.9) {
                       telecomTag = "住宅型";
                       telecomIcon = <Moon size={12} className="text-indigo-500"/>;
                     }

                     return (
                       <div key={dist.district} className="p-4 rounded-xl border border-slate-100 hover:shadow-md transition-shadow group bg-slate-50/50">
                          <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">{idx + 1}</span>
                              <span className="font-bold text-slate-700">{dist.district}</span>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>
                              {badgeText}
                            </span>
                          </div>
                          
                          {/* 電信指標 */}
                          <div className="flex items-center gap-2 mb-3 bg-white px-2 py-1 rounded border border-slate-100 w-fit">
                             <Smartphone size={12} className="text-slate-400"/>
                             <span className="text-[10px] text-slate-500">
                               日夜比: {dist.dayNightRatio.toFixed(2)}
                             </span>
                             {telecomTag && (
                               <div className="flex items-center gap-1 ml-1 pl-1 border-l border-slate-200">
                                 {telecomIcon}
                                 <span className="text-[10px] font-medium text-slate-600">{telecomTag}</span>
                               </div>
                             )}
                          </div>

                          <div className="grid grid-cols-2 gap-4 mb-2">
                             <div>
                               <p className="text-[10px] text-slate-400">現況覆蓋率</p>
                               <p className="text-lg font-bold text-blue-500">{(dist.coverageNow * 100).toFixed(1)}%</p>
                             </div>
                             <div className="text-right">
                               <p className="text-[10px] text-slate-400">布建後覆蓋率</p>
                               <div className="flex items-center justify-end gap-1">
                                  <p className="text-lg font-bold text-teal-500">{(dist.coverageFuture * 100).toFixed(1)}%</p>
                               </div>
                             </div>
                          </div>

                          <div className="bg-white rounded-lg p-2 flex justify-between items-center text-xs border border-slate-100">
                             <span className="text-slate-500">缺口人數</span>
                             <div className="flex items-center gap-2 font-medium">
                                <span className="text-rose-400">{Math.round(dist.gapNow)}</span>
                                <TrendingUp size={12} className="text-slate-300 rotate-90"/>
                                <span className={dist.gapFuture > 0 ? "text-orange-500" : "text-slate-400"}>
                                  {Math.round(dist.gapFuture)}
                                </span>
                             </div>
                          </div>
                       </div>
                     );
                   })
                 ) : (
                   <div className="text-center py-10 text-slate-400 text-sm">
                     載入數據中...
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

export default App;