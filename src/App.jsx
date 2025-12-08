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
  Building2, FileText, CheckCircle2, CheckCircle, Layout, Home, Search, User, 
  Loader2, ChevronDown, Baby, TrendingUp, AlertTriangle, AlertCircle, Target, Info, 
  Smartphone, Sun, Moon, Users, Accessibility, HandCoins, HeartHandshake, 
  Filter, X, Menu, BarChart2
} from 'lucide-react';
import { 
  PieChart, Pie, Cell, 
  LineChart, Line, BarChart, Bar, ComposedChart, ReferenceLine,
  PieChart, Pie, Cell, LineChart, Line, BarChart, Bar, ComposedChart, ReferenceLine,
XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, LabelList
} from 'recharts';

// --- 輔助函式：數值解析 (移除千分位逗號) ---
// --- LOGO 設定 ---
const LOGO_URL = "/綜合規劃股儀表板logo.jpg"; 

// ==========================================
// 共用工具函式
// ==========================================
const parseNumber = (v) => {
  if (!v) return 0;
  if (v === undefined || v === null || v === '') return 0;
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
  return String(name).trim().replace(/臺/g, '台').replace(/^台北市/, '').replace(/台彎省/, '').replace(/\s+/g, '').replace(/區$/, '');
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
      if (line[i] === '"') inQuotes = !inQuotes;
      else if (line[i] === separator && !inQuotes) {
let val = line.substring(start, i);
val = val.replace(/^"|"$/g, '').replace(/^\uFEFF/, '').trim();
result.push(val);
@@ -83,33 +58,38 @@ const parseData = (text, headerKeyword = null) => {
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
      if (cleanHeader) entry[cleanHeader] = values[index] || '';
});
return entry;
});
};

// --- 專用解析器：人口資料 (Population) ---
const parseCellB15 = (text) => {
  if (!text) return 0;
  const lines = text.split('\n');
  if (lines.length < 15) return 0; 
  const line15 = lines[14]; 
  const separator = line15.includes('\t') ? '\t' : ',';
  const cols = line15.split(separator);
  // [Fix] Add (cols[1] || '') check to prevent undefined.replace error
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
@@ -124,214 +104,113 @@ const parsePopulationData = (text) => {
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

    if (cols.length > 7) entry['raw_col_h'] = cols[7]; // H欄 Index 7
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

  const [loading, setLoading] = useState(true);
  
const [pmSearchTerm, setPmSearchTerm] = useState('');
  const [selectedBase, setSelectedBase] = useState(null);
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
    if (!isDropdownOpen) setPmSearchTerm('');
setIsDropdownOpen(!isDropdownOpen);
};

useEffect(() => {
    const fetchAllData = async () => {
    const fetchData = async () => {
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
        const urls = [
            'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=0&single=true&output=csv',
            'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=513929673&single=true&output=csv',
            'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=951116094&single=true&output=csv',
            'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=47182957&single=true&output=csv',
            'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=1074300767&single=true&output=csv',
            'https://docs.google.com/spreadsheets/d/e/2PACX-1vRwO5RTzYCCo9PiNc0kl-rCWZsYlnVsw89z8QxC61F9CZyjEDO_nCpJaODaJVl5k4_xC3yIHRYTypVN/pub?gid=1894885880&single=true&output=csv'
        ];
        const responses = await Promise.all(urls.map(url => fetch(url).then(r => r.text())));

        // 解析 B15 取得 118 年 0-1 歲推估總數
        const pFuture = parseCellB15(resPopFut);
        setPopFutureTotal(pFuture);

        setTelecomData(parseData(resTelecom));
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

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    const handleClickOutside = (e) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsDropdownOpen(false);
};
    fetchAllData();
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    
    const findKey = (obj, keywords) => Object.keys(obj).find(k => keywords.some(w => k.replace(/\s/g,'').includes(w)));
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
  const baseList = useMemo(() => processedData.filter(i => i.baseName.trim() && i.pmName.trim())
    .filter((i, idx, self) => idx === self.findIndex(t => t.baseName === i.baseName)), [processedData]);
  
  const filteredBases = useMemo(() => pmSearchTerm ? baseList.filter(i => i.baseName.includes(pmSearchTerm)) : baseList, [baseList, pmSearchTerm]);

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
    if (csvData.length === 0) return { total: 0, labor: 0, commission: 0, program: 0 };
    return { total: 305, labor: 165, commission: 127, program: 16 };
  }, [csvData]);

const trendData = useMemo(() => {
    if (processedData.length === 0) return [];
const startRange = 110, endRange = 123;
const result = [];
const targetTypes = ["公辦民營(勞務)", "公辦民營(委營)", "方案委託(帶地投標)"];
@@ -341,427 +220,234 @@ const App = () => {
processedData.forEach(item => {
if (!targetTypes.includes(item.type) || !item.id || !item.startYear) return;
const hasStarted = item.startYear <= year;
        let hasEnded = false;
        if ((item.status === '已結束' || item.status === '已撤點') && item.endYear && year > item.endYear) {
           hasEnded = true;
        }
        if (hasStarted && !hasEnded) activeSet.add(item.id);
        if (hasStarted) activeSet.add(item.id);
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
    const safeDefault = { 
        districtSummary: [], 
        cityStats: { coverageNow: 0, coverageFuture: 0, popNow: 0, popFuture: 0, capNow: 0, capFuture: 0 }, 
        cumulativeTrend: [] 
};

    const districtMap = {};
    if (popData.length === 0) return safeDefault;

    // A. 處理 Population (現況 0-1 歲總和)
    const getVal = (obj, kw) => { const k = Object.keys(obj).find(k=>kw.some(w=>k.includes(w))); return k?parseNumber(obj[k]):0; };
    const getStr = (obj, kw) => { const k = Object.keys(obj).find(k=>kw.some(w=>k.includes(w))); return k?String(obj[k]).trim():''; };

    const districtMap = {};
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
        const rawDist = getStr(row, ['行政區', '區別']);
        if (!rawDist || rawDist.includes('總計')) return;
        const normDist = normalizeDistrict(rawDist);
        if (!normDist) return;
        const pop0 = getVal(row, ['0歲']), pop1 = getVal(row, ['1歲']);
        
        if (!districtMap[normDist]) districtMap[normDist] = { district: rawDist, popNow: 0, popFuture: 0, capacityNow: 0, futureCapacity: 0, telecom: {day:0,night:0} };
        districtMap[normDist].popNow += (pop0 + pop1);
        districtMap[normDist].popFuture += parseNumber(row['raw_col_h']); 
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
    
    const totalPopNow = Object.values(districtMap).reduce((a,b)=>a+b.popNow,0);
    const growthRate = popFutureTotal > 0 ? popFutureTotal / totalPopNow : 0.92;
    Object.values(districtMap).forEach(d => {
        if(d.popFuture === 0) d.popFuture = Math.round(d.popNow * growthRate);
});

    // C. 處理 Telecom Data
    telecomData.forEach(row => {
      const rawDist = getStr(row, ['行政區', '區別']);
      const normDist = normalizeDistrict(rawDist);
      if (districtMap[normDist]) {
        districtMap[normDist].telecom.night = getVal(row, ['夜間', '停留']);
        districtMap[normDist].telecom.day = getVal(row, ['日間活動', '日間']);
      }
    let cityCapNow = 0, cityCapFut = 0;
    childcareNowData.forEach(row => {
        const d = normalizeDistrict(getStr(row, ['行政區']));
        const cap = getVal(row, ['收托']);
        if (districtMap[d]) { districtMap[d].capacityNow += cap; cityCapNow += cap; }
});

    // D. 處理 Childcare Future (與計算趨勢)
    const futureByYear = {}; 
    let cityCapacityFuture = 0;

    const futureByYear = {};
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
        const futurePop = d.popFuture || d.popNow; 
        const capFutTotal = d.capacityNow + d.futureCapacity;
        // [Fix] Ensure calculations result in valid numbers, fallback to 0
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

      const dayNightRatio = d.telecom.night > 0 ? (d.telecom.day / d.telecom.night) : 1;
    const trend = [{year:'113(基期)', capacity: cityCapNow}];
    let cum = cityCapNow;
    for(let y=114; y<=118; y++) { cum += (futureByYear[y]||0); trend.push({year:`${y}年`, capacity: cum}); }

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
    const cityPopFuture = Object.values(districtMap).reduce((a,b)=>a+b.popFuture, 0);
    const cityCapTotalFuture = cityCapNow + cityCapFut;
    const cityCoverageFuture = cityPopFuture > 0 ? cityCapTotalFuture / cityPopFuture : 0;

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
  }, [popData, childcareNowData, childcareFutureData, telecomData]);
  }, [popData, childcareNowData, childcareFutureData, telecomData, popFutureTotal]);

  const chartData = useMemo(() => {
    return [...districtSummary].sort((a, b) => a.district.localeCompare(b.district)); 
  }, [districtSummary]);
  const chartData = useMemo(() => [...districtSummary].sort((a,b) => a.district.localeCompare(b.district)), [districtSummary]);

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

  const SectionTitle = ({ title, colorClass = "bg-teal-500", icon: Icon }) => (
    <div className="flex items-center gap-3 mb-6">
      <div className={`w-1.5 h-8 ${colorClass}`}></div>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="text-slate-700" size={24} />}
        <h2 className="text-xl font-bold text-slate-700">{title}</h2>
      </div>
    </div>
  );
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
    <div className="min-h-screen bg-orange-50/30 font-sans text-slate-800 pb-20">
      <Header />

      <main className="max-w-[1600px] mx-auto px-8 pt-10 space-y-12">

        {/* --- 第一區塊：基地大樓 PM 查詢 --- */}
    <div className="space-y-8 animate-in fade-in duration-500">
        {/* 1. PM Search */}
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
                  ))}
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
                <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl p-6 border border-blue-100 min-h-[120px] flex items-center justify-between shadow-sm">
                    <div>
                        <p className="text-sm text-slate-500 font-medium mb-1">對應 PM (專案負責人)</p>
                        <div className="text-2xl font-bold text-slate-800 tracking-tight">{selectedBase ? selectedBase.pmName : '--'}</div>
                    </div>
                    <div className="bg-white p-4 rounded-full shadow-sm text-blue-500 border border-blue-50"><User size={32} /></div>
</div>
              </div>
              <div className="bg-white p-3 rounded-full shadow-sm text-blue-500">
                <User size={32} />
              </div>
            </div>
          </div>
             </div>
</section>

        {/* --- 第二區塊：委外服務設施現況與趨勢 --- */}
        {/* 2. Stats Cards */}
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
            <div className="flex items-center gap-3 mb-6"><div className="w-1.5 h-8 bg-orange-500 rounded-full"></div><h2 className="text-xl font-bold text-slate-700">委外服務設施現況與趨勢</h2></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[{title:'已開辦總家數',val:stats.total,sub:'含委營/勞務',c:'orange'},{title:'公辦民營(勞務)',val:stats.labor,sub:'現有營運',c:'teal'},{title:'公辦民營(委營)',val:stats.commission,sub:'現有營運',c:'blue'},{title:'方案委託',val:stats.program,sub:'現有營運',c:'rose'}].map((s,i)=>(
                    <div key={i} className={`bg-white p-6 rounded-2xl shadow-sm border border-${s.c}-100 flex items-center gap-4 hover:shadow-md transition-shadow duration-300`}>
                        <div className={`w-14 h-14 rounded-2xl bg-${s.c}-50 flex items-center justify-center text-${s.c}-500 shadow-sm border border-${s.c}-100`}><FileText size={28}/></div>
                        <div><p className="text-xs text-slate-400 mb-1 font-medium">{s.title}</p><h3 className="text-3xl font-black text-slate-800">{s.val}</h3><p className="text-[10px] text-slate-400 mt-1 bg-slate-50 px-2 py-0.5 rounded-full inline-block">{s.sub}</p></div>
                    </div>
                ))}
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

        {/* --- 第四區塊：社宅參建 | 福利設施開箱 --- */}
        {/* 4. Social Housing */}
<section>
          <SectionTitle title="社宅參建 | 福利設施開箱" colorClass="bg-teal-500" icon={Building2} />
          
          <div className="flex items-center gap-3 mb-6"><div className="w-1.5 h-8 bg-teal-500 rounded-full"></div><h2 className="text-xl font-bold text-slate-700">社宅參建 | 福利設施開箱</h2></div>
<div className="grid grid-cols-12 gap-6">
<div className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[500px]">
<h3 className="text-lg font-medium text-slate-600 mb-8">服務對象佔比 (社宅參建)</h3>
<div className="relative w-full h-[300px]">
                {housingPieData.length > 0 ? (
                {ResponsiveContainer && (
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
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-300">
                  <Home size={48} strokeWidth={1.5} />
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-300"><Home size={48} strokeWidth={1.5} /></div>
</div>
<div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-6 max-w-xs text-xs text-slate-500">
{housingPieData.map((entry, index) => (
@@ -776,319 +462,851 @@ const App = () => {
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
                        ))}
                      </div>
                        </div>
                      ))}
</div>
                  ))
                ) : (
                  <div className="text-center text-slate-400 py-10">尚無社宅參建資料</div>
                )}
                  </div>
                ))}
</div>
</div>
</div>
</section>

        {/* --- 第五區塊：公托覆蓋率與缺口分析 (New Layout) --- */}
        {/* 5. Childcare Analysis */}
<section>
          <SectionTitle title="公托覆蓋率與缺口分析" colorClass="bg-rose-500" icon={Baby} />
          <div className="flex items-center gap-3 mb-6"><div className="w-1.5 h-8 bg-rose-500 rounded-full"></div><h2 className="text-xl font-bold text-slate-700">公托覆蓋率與缺口分析</h2></div>

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
               <h3 className="text-lg font-bold text-slate-700 mb-6 flex items-center gap-2"><TrendingUp className="text-orange-500"/> 114-118年 公托累計收托量成長趨勢</h3>
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
                 <ResponsiveContainer><AreaChart data={cumulativeTrend} margin={{top:20,right:30,left:0,bottom:0}}>
                    <defs><linearGradient id="colorCap" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F97316" stopOpacity={0.1}/><stop offset="95%" stopColor="#F97316" stopOpacity={0}/></linearGradient></defs>
                    <XAxis dataKey="year" tick={{fill:'#94a3b8'}} axisLine={false} tickLine={false}/><YAxis domain={['dataMin - 100', 'auto']} tick={{fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{borderRadius:'12px', border:'none', boxShadow:'0 4px 20px rgba(0,0,0,0.08)'}}/><Area type="monotone" dataKey="capacity" stroke="#F97316" strokeWidth={3} fill="url(#colorCap)"><LabelList dataKey="capacity" position="top" fill="#F97316" fontSize={12} offset={10}/></Area>
                 </AreaChart></ResponsiveContainer>
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
            
            {/* (A) 左側：各行政區覆蓋率圖表 */}
<div className="col-span-12 lg:col-span-8 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[500px]">
<div className="flex justify-between items-start mb-6">
<div>
                   <h3 className="text-lg font-bold text-slate-700">各行政區公托覆蓋率</h3>
                   <div className="text-sm text-slate-500 mt-2 space-y-1">
                     <p>現況：以114年11月各區0-1歲幼兒人口為分母計算覆蓋率</p>
                     <p>布建後：以目標年度(118年)推估之各區0–1歲幼兒人口為分母計算覆蓋率</p>
                   </div>
                    <h3 className="text-lg font-bold text-slate-700">各行政區公托覆蓋率</h3>
                    <div className="text-sm text-slate-500 mt-2 space-y-1">
                     <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-400"></span>現況：以114年11月各區0-1歲幼兒人口為分母計算</p>
                     <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-teal-400"></span>布建後：以目標年度(118年)推估之各區0–1歲幼兒人口為分母</p>
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

            {/* (B) 右側：優先改善行政區清單 */}
<div className="col-span-12 lg:col-span-4 bg-white rounded-3xl p-8 shadow-sm border border-slate-100 min-h-[500px] flex flex-col">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                  <AlertTriangle className="text-rose-500" size={20} />
                  優先改善行政區
                </h3>
                <p className="text-xs text-slate-400 mt-1">依據 10% 覆蓋目標之缺口規模與比例排序</p>
              </div>

              <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2 mb-6"><AlertTriangle className="text-rose-500"/> 優先改善行政區</h3>
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
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400">布建後覆蓋率</p>
                            <div className="flex items-center justify-end gap-1">
                              <p className="text-lg font-bold text-teal-500">
                                {/* [Fix] Add fallback for dist.coverageFuture */}
                                {(dist.coverageFuture * 100 || 0).toFixed(1)}%
                              </p>
                            </div>
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
        <Loader2 className="animate-spin mr-2" /> 載入社宅數據中…
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

              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  * 公托容量全部採用收托人數欄位計算。
                  <br/>
                  * 排序依據優先改善指數 (Priority Score)，不因電信指標變動。
                  <br/>
                  * 日夜比依內政部112年電信信令人口統計計算
                </p>
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
        </section>

      </main>
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

      <footer className="mt-20 py-8 text-center text-xs text-slate-300 border-t border-slate-100">
        Taipei City Government Social Welfare Dashboard<br />
        Live Data connected to Google Sheet
      </footer>
      {/* Sidebar (Left Navigation) */}
      <aside className="w-full md:w-72 bg-white border-r border-slate-200 flex-shrink-0 md:h-screen sticky top-0 z-50 flex flex-col">
          {/* Logo Area */}
          <div className="h-24 flex items-center px-6 border-b border-slate-100">
             <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200">綜</div>
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
export default App;
