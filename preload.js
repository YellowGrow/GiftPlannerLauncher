const { contextBridge, ipcRenderer } = require('electron');

// 렌더러 프로세스에서 사용할 API 노출
contextBridge.exposeInMainWorld('electronAPI', {
  // 창 컨트롤
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  quit: () => ipcRenderer.invoke('window:quit'),
  
  // 투명도
  setOpacity: (opacity) => ipcRenderer.invoke('window:setOpacity', opacity),
  getOpacity: () => ipcRenderer.invoke('window:getOpacity'),
  
  // 항상 위에
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('window:setAlwaysOnTop', flag),
  getAlwaysOnTop: () => ipcRenderer.invoke('window:getAlwaysOnTop'),
  
  // 클릭 무시
  setClickThrough: (ignore) => ipcRenderer.invoke('window:setClickThrough', ignore),
  
  // 원래 자리로
  resetPosition: () => ipcRenderer.invoke('window:resetPosition'),
  
  // 창 고정
  setLocked: (locked) => ipcRenderer.invoke('window:setLocked', locked),
  
  // 설정
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  
  // 플랜 관리
  getAllPlans: () => ipcRenderer.invoke('plans:getAll'),
  savePlans: (plans) => ipcRenderer.invoke('plans:save', plans),
  getCurrentPlan: () => ipcRenderer.invoke('plans:getCurrent'),
  setCurrentPlan: (plan) => ipcRenderer.invoke('plans:setCurrent', plan),
  
  // 클립보드
  parsePlanFromClipboard: () => ipcRenderer.invoke('clipboard:getPlan'),
  
  // 외부 링크
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  
  // 이벤트 리스너
  onLoadPlan: (callback) => {
    ipcRenderer.on('load-plan', (event, plan) => callback(plan));
  }
});
