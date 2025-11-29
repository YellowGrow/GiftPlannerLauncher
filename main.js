const { app, BrowserWindow, ipcMain, Menu, Tray, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

// 단일 인스턴스 잠금
const gotTheLock = app.requestSingleInstanceLock();

let mainWindow = null;
let tray = null;
let currentPlan = null;

// 설정 파일 경로
const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');
const plansPath = path.join(userDataPath, 'plans.json');

// 기본 설정
const defaultSettings = {
  opacity: 1.0,
  alwaysOnTop: false,
  windowBounds: { width: 480, height: 900, x: undefined, y: undefined },
  theme: 'dark'
};

// 시작 시 처리할 프로토콜 URL
let pendingProtocolUrl = null;

// 설정 로드
function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return { ...defaultSettings, ...JSON.parse(fs.readFileSync(settingsPath, 'utf-8')) };
    }
  } catch (e) {
    console.error('설정 로드 실패:', e);
  }
  return defaultSettings;
}

// 설정 저장
function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('설정 저장 실패:', e);
  }
}

// 플랜 로드
function loadPlans() {
  try {
    if (fs.existsSync(plansPath)) {
      return JSON.parse(fs.readFileSync(plansPath, 'utf-8'));
    }
  } catch (e) {
    console.error('플랜 로드 실패:', e);
  }
  return [];
}

// 플랜 저장
function savePlans(plans) {
  try {
    fs.writeFileSync(plansPath, JSON.stringify(plans, null, 2));
  } catch (e) {
    console.error('플랜 저장 실패:', e);
  }
}

// 두 번째 인스턴스가 실행되면 첫 번째 인스턴스 활성화
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    console.log('second-instance 이벤트, commandLine:', commandLine);
    
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      
      // URL 프로토콜로 전달된 데이터 처리
      const url = commandLine.find(arg => arg.startsWith('limbus-planner://'));
      console.log('찾은 URL:', url);
      if (url) {
        handleProtocolUrl(url);
      } else {
        // URL이 없어도 클립보드 확인
        handleProtocolUrl('limbus-planner://open');
      }
    }
  });
}

// 커스텀 프로토콜 핸들러 (limbus-planner://)
function handleProtocolUrl(url) {
  try {
    console.log('프로토콜 URL 수신:', url);
    
    // 먼저 클립보드에서 플랜 데이터 확인
    const clipboardText = clipboard.readText();
    if (clipboardText && clipboardText.startsWith('LIMBUS_PLAN:')) {
      const base64Data = clipboardText.replace('LIMBUS_PLAN:', '');
      console.log('클립보드에서 플랜 데이터 발견, 길이:', base64Data.length);
      
      try {
        const jsonStr = decodeURIComponent(escape(atob(base64Data)));
        const plan = JSON.parse(jsonStr);
        console.log('플랜 데이터 파싱 성공:', plan.name);
        currentPlan = plan;
        
        // 클립보드 클리어 (재사용 방지)
        clipboard.writeText('');
        
        if (mainWindow) {
          mainWindow.webContents.send('load-plan', plan);
          mainWindow.show();
          mainWindow.focus();
        }
        return;
      } catch (e) {
        console.error('클립보드 데이터 파싱 실패:', e);
      }
    }
    
    // 클립보드에 없으면 URL 파라미터에서 시도 (하위 호환)
    const planMatch = url.match(/[?&]plan=([^&]+)/);
    if (planMatch && planMatch[1]) {
      const base64Data = planMatch[1];
      console.log('URL에서 Base64 데이터 발견, 길이:', base64Data.length);
      
      // Base64 디코딩
      const jsonStr = decodeURIComponent(escape(atob(base64Data)));
      const plan = JSON.parse(jsonStr);
      console.log('플랜 데이터 파싱 성공:', plan.name);
      currentPlan = plan;
      
      if (mainWindow) {
        mainWindow.webContents.send('load-plan', plan);
        mainWindow.show();
        mainWindow.focus();
      } else {
        console.log('mainWindow가 없음, 창 생성 대기');
      }
    } else {
      console.log('plan 파라미터를 찾을 수 없음');
    }
  } catch (e) {
    console.error('프로토콜 URL 처리 실패:', e);
  }
}

function createWindow() {
  console.log('createWindow() 호출');
  const settings = loadSettings();
  console.log('설정 로드됨:', settings);
  
  // 화면 크기 가져오기
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  // 창 크기: 가로 20%, 세로 100%
  const windowWidth = Math.round(screenWidth * 0.2);
  const windowHeight = screenHeight;
  
  // 위치: 화면 왼쪽 끝
  const windowX = 0;
  const windowY = 0;

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: windowX,
    y: windowY,
    minWidth: 280,
    minHeight: 400,
    frame: false,
    transparent: false,
    backgroundColor: '#1a1a2e',
    alwaysOnTop: settings.alwaysOnTop,
    skipTaskbar: false,
    show: false,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  // 창이 준비되면 보여주기
  mainWindow.once('ready-to-show', () => {
    console.log('ready-to-show fired');
    mainWindow.show();
    mainWindow.setOpacity(settings.opacity);
    
    // 항상 위에 설정이 켜져 있으면 floating 레벨로 적용
    if (settings.alwaysOnTop) {
      mainWindow.setAlwaysOnTop(true, 'floating');
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 로드 실패 처리
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('페이지 로드 실패:', errorCode, errorDescription);
  });

  // 로드 성공 처리 - 여기서 대기 중인 프로토콜 URL 처리
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('페이지 로드 완료');
    
    // 시작 시 대기 중인 프로토콜 URL이 있으면 처리
    if (pendingProtocolUrl) {
      console.log('대기 중인 프로토콜 URL 처리:', pendingProtocolUrl);
      handleProtocolUrl(pendingProtocolUrl);
      pendingProtocolUrl = null;
    }
  });

  // 창 위치/크기 저장
  mainWindow.on('close', () => {
    const bounds = mainWindow.getBounds();
    const currentSettings = loadSettings();
    currentSettings.windowBounds = bounds;
    saveSettings(currentSettings);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 개발자 도구 (디버깅용)
  mainWindow.webContents.openDevTools();
}

// 트레이 아이콘 생성
function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  
  // 아이콘 파일이 없으면 기본 아이콘 사용
  if (!fs.existsSync(iconPath)) {
    return;
  }
  
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: '보이기/숨기기', 
      click: () => {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
        }
      }
    },
    { type: 'separator' },
    { 
      label: '항상 위에', 
      type: 'checkbox',
      checked: loadSettings().alwaysOnTop,
      click: (menuItem) => {
        const settings = loadSettings();
        settings.alwaysOnTop = menuItem.checked;
        saveSettings(settings);
        mainWindow.setAlwaysOnTop(menuItem.checked);
      }
    },
    { type: 'separator' },
    { 
      label: '종료', 
      click: () => {
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('림버스 플랜 실행기');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
}

// IPC 핸들러
function setupIPC() {
  // 창 컨트롤
  ipcMain.handle('window:minimize', () => mainWindow.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.handle('window:close', () => app.quit()); // 창 닫으면 앱 종료
  ipcMain.handle('window:quit', () => app.quit());
  
  // 투명도
  ipcMain.handle('window:setOpacity', (event, opacity) => {
    mainWindow.setOpacity(opacity);
    const settings = loadSettings();
    settings.opacity = opacity;
    saveSettings(settings);
  });
  
  ipcMain.handle('window:getOpacity', () => {
    return loadSettings().opacity;
  });
  
  // 항상 위에 (floating 레벨로 설정 - 다른 앱에 영향 없음)
  ipcMain.handle('window:setAlwaysOnTop', (event, flag) => {
    if (flag) {
      mainWindow.setAlwaysOnTop(true, 'floating');
    } else {
      mainWindow.setAlwaysOnTop(false);
    }
    const settings = loadSettings();
    settings.alwaysOnTop = flag;
    saveSettings(settings);
  });
  
  ipcMain.handle('window:getAlwaysOnTop', () => {
    return loadSettings().alwaysOnTop;
  });
  
  // 클릭 무시 (클릭이 뒤 창으로 통과)
  ipcMain.handle('window:setClickThrough', (event, ignore) => {
    // ignore가 true면 클릭 무시, false면 정상
    // forward: true로 설정하면 특정 영역에서는 클릭 가능
    mainWindow.setIgnoreMouseEvents(ignore, { forward: true });
  });
  
  // 원래 자리로 (화면 왼쪽, 가로 20%, 세로 100%)
  ipcMain.handle('window:resetPosition', () => {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    
    const windowWidth = Math.round(screenWidth * 0.2);
    const windowHeight = screenHeight;
    
    mainWindow.setBounds({
      x: 0,
      y: 0,
      width: windowWidth,
      height: windowHeight
    });
  });
  
  // 창 위치/크기 고정
  ipcMain.handle('window:setLocked', (event, locked) => {
    mainWindow.setMovable(!locked);
    mainWindow.setResizable(!locked);
  });
  
  // 설정
  ipcMain.handle('settings:get', () => loadSettings());
  ipcMain.handle('settings:set', (event, newSettings) => {
    const settings = { ...loadSettings(), ...newSettings };
    saveSettings(settings);
    return settings;
  });
  
  // 플랜 관리
  ipcMain.handle('plans:getAll', () => loadPlans());
  ipcMain.handle('plans:save', (event, plans) => {
    savePlans(plans);
    return true;
  });
  ipcMain.handle('plans:getCurrent', () => currentPlan);
  ipcMain.handle('plans:setCurrent', (event, plan) => {
    currentPlan = plan;
    return true;
  });
  
  // 클립보드에서 플랜 가져오기
  ipcMain.handle('clipboard:getPlan', () => {
    try {
      const text = clipboard.readText();
      const plan = JSON.parse(text);
      if (plan && plan.name && plan.floors) {
        return plan;
      }
    } catch (e) {
      // JSON이 아니거나 플랜 형식이 아님
    }
    return null;
  });
  
  // 외부 링크 열기
  ipcMain.handle('shell:openExternal', (event, url) => {
    shell.openExternal(url);
  });
}

app.whenReady().then(() => {
  console.log('app.whenReady() - 앱 시작');
  
  // 커스텀 프로토콜 등록
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('limbus-planner', process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient('limbus-planner');
  }
  
  // 명령줄에서 URL 확인 (창 생성 전에 저장)
  const urlArg = process.argv.find(arg => arg.startsWith('limbus-planner://'));
  if (urlArg) {
    console.log('시작 시 프로토콜 URL 발견:', urlArg);
    pendingProtocolUrl = urlArg;
  }
  
  createWindow();
  // createTray(); // 아이콘 없이는 트레이 생성 안함
  setupIPC();
  
  console.log('앱 초기화 완료');
});

app.on('window-all-closed', () => {
  // 모든 창이 닫히면 앱 종료
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// macOS에서 프로토콜 URL 처리
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleProtocolUrl(url);
});
