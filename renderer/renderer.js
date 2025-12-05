// renderer.js - 팝업 창과 동일한 기능 구현

// 플랜 데이터
let currentPlan = null;
let floorTargets = [];
let startingGifts = [];
let generalGifts = [];
let allGiftsData = [];
let synthesisIds = new Set();
let currentFloorIndex = -1; // -1 = 시작 기프트 페이지
let totalFloors = 0;

// 필터 상태
let activeKeywords = new Set();
let activeTiers = new Set();
let searchQuery = '';

// 획득 상태
let acquiredGifts = new Set(); // 획득한 기프트 ID 세트
let manuallyAcquiredGifts = new Set(); // 사용자가 직접 클릭한 기프트 ID
let synthesisIngredientsMap = new Map(); // 합성 기프트 ID -> 재료 기프트 ID 배열

// 이미지 기본 경로 (실제 배포된 도메인)
const IMAGE_BASE_URL = 'https://limbusgiftplanner.pages.dev/';

// URL 인코딩 함수 (한글 경로 처리)
function encodeImagePath(path) {
    if (!path) return '';
    // 각 경로 세그먼트를 개별적으로 인코딩
    return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
}

// =====================
// 유틸리티 함수
// =====================

function getRomanNumeral(tier) {
    const numerals = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 'ex': 'EX', 'EX': 'EX' };
    return numerals[tier] || tier || '';
}

// HTML 이스케이프 함수
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 플랜 설명 펼치기/접기
function togglePlanDescription() {
    const toggle = document.querySelector('.description-toggle');
    const content = document.querySelector('.description-content');
    if (toggle && content) {
        toggle.classList.toggle('expanded');
        content.classList.toggle('expanded');
    }
}

// 층 설명 펼치기/접기
function toggleFloorMemo(btn) {
    const wrapper = btn.closest('.floor-memo-wrapper');
    if (wrapper) {
        const content = wrapper.querySelector('.floor-memo-content');
        btn.classList.toggle('expanded');
        content.classList.toggle('expanded');
    }
}

function getKeywordIconUrl(keyword) {
    if (!keyword || keyword === '범용') return null;
    const gimicKeywords = ['화상', '출혈', '진동', '파열', '침잠', '호흡', '충전'];
    const attackKeywords = ['참격', '관통', '타격'];
    
    if (gimicKeywords.includes(keyword)) {
        return IMAGE_BASE_URL + encodeImagePath('기타/기믹_' + keyword + '.webp');
    } else if (attackKeywords.includes(keyword)) {
        return IMAGE_BASE_URL + encodeImagePath('기타/공격유형_' + keyword + '.webp');
    }
    return null;
}

function getGiftImageUrl(image) {
    if (!image) return null;
    return IMAGE_BASE_URL + encodeImagePath('에고기프트/' + image);
}

function getPackImageUrl(image) {
    if (!image) return null;
    return IMAGE_BASE_URL + encodeImagePath('테마팩/' + image);
}

// 현재 앵 버전
const APP_VERSION = '1.0.8';
const GITHUB_RELEASES_API = 'https://api.github.com/repos/YellowGrow/GiftPlannerLauncher/releases/latest';
const UPDATE_DOWNLOAD_PAGE = 'https://limbusgiftplanner.pages.dev/#download';

// =====================
// UI 초기화
// =====================

document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
    initializeEventListeners();
    
    // Electron API로 설정 로드
    loadSettings();
    
    // 버전 체크
    checkForUpdates();
});

function initializeUI() {
    // 초기 상태: 플랜 없음 화면 표시
    document.getElementById('no-plan-view').classList.remove('hidden');
    document.getElementById('plan-view').classList.add('hidden');
    
    // 버전 정보 표시
    const versionInfo = document.getElementById('version-info');
    if (versionInfo) {
        versionInfo.textContent = 'v' + APP_VERSION;
    }
}

// =====================
// 버전 체크 및 업데이트 알림
// =====================

async function checkForUpdates() {
    try {
        const response = await fetch(GITHUB_RELEASES_API);
        if (!response.ok) return;
        
        const release = await response.json();
        const latestVersion = release.tag_name.replace('v', '');
        
        if (isNewerVersion(latestVersion, APP_VERSION)) {
            showUpdateBanner(latestVersion);
        }
    } catch (e) {
        console.log('버전 체크 실패:', e);
    }
}

function isNewerVersion(latest, current) {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);
    
    for (let i = 0; i < Math.max(latestParts.length, currentParts.length); i++) {
        const l = latestParts[i] || 0;
        const c = currentParts[i] || 0;
        if (l > c) return true;
        if (l < c) return false;
    }
    return false;
}

function showUpdateBanner(newVersion) {
    const banner = document.getElementById('update-banner');
    const text = banner.querySelector('.update-text');
    text.textContent = `새 버전 v${newVersion}이 있습니다!`;
    banner.classList.remove('hidden');
    
    // 업데이트 버튼 클릭
    document.getElementById('update-btn').addEventListener('click', () => {
        if (window.electronAPI) {
            window.electronAPI.openExternal(UPDATE_DOWNLOAD_PAGE);
        }
    });
    
    // 닫기 버튼 클릭
    document.getElementById('update-close').addEventListener('click', () => {
        banner.classList.add('hidden');
    });
}

function initializeEventListeners() {
    // 타이틀바 버튼
    document.getElementById('settings-btn').addEventListener('click', toggleSettingsPanel);
    document.getElementById('minimize-btn').addEventListener('click', () => {
        if (window.electronAPI) window.electronAPI.minimize();
    });
    document.getElementById('close-btn').addEventListener('click', () => {
        if (window.electronAPI) window.electronAPI.quit();
    });
    
    // 원래 자리로 버튼
    document.getElementById('reset-position-btn').addEventListener('click', () => {
        if (window.electronAPI) window.electronAPI.resetPosition();
    });
    
    // 설정 패널
    document.getElementById('opacity-slider').addEventListener('input', handleOpacityChange);
    document.getElementById('always-on-top-check').addEventListener('change', handleAlwaysOnTopChange);
    document.getElementById('click-through-check').addEventListener('change', handleClickThroughChange);
    document.getElementById('lock-window-check').addEventListener('change', handleLockWindowChange);
    
    // 표시 모드 버튼
    document.getElementById('view-mode-name').addEventListener('click', () => toggleViewMode('name'));
    document.getElementById('view-mode-image').addEventListener('click', () => toggleViewMode('image'));
    
    // 초기화 버튼 및 확인 모달
    document.getElementById('reset-selection-btn').addEventListener('click', showResetConfirmModal);
    document.getElementById('confirm-reset-yes').addEventListener('click', () => {
        resetAllSelections();
        hideResetConfirmModal();
    });
    document.getElementById('confirm-reset-no').addEventListener('click', hideResetConfirmModal);
    
    // 사이트로 이동 버튼
    document.getElementById('goto-site-btn').addEventListener('click', () => {
        if (window.electronAPI) {
            window.electronAPI.openExternal('https://limbusgiftplanner.pages.dev/');
        }
    });
    
    // 층 네비게이션
    document.getElementById('prevFloorBtn').addEventListener('click', () => changeFloor(-1));
    document.getElementById('nextFloorBtn').addEventListener('click', () => changeFloor(1));
    
    // 검색 입력
    document.getElementById('giftSearchInput').addEventListener('input', (e) => {
        searchQuery = e.target.value;
        applyFilters();
    });
    
    // 키워드 필터 버튼
    document.querySelectorAll('.keyword-filters .filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const keyword = btn.dataset.keyword;
            if (activeKeywords.has(keyword)) {
                activeKeywords.delete(keyword);
                btn.classList.remove('active');
            } else {
                activeKeywords.add(keyword);
                btn.classList.add('active');
            }
            applyFilters();
        });
    });
    
    // 등급 필터 버튼
    document.querySelectorAll('.tier-filters .tier-quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tier = btn.dataset.tier;
            if (activeTiers.has(tier)) {
                activeTiers.delete(tier);
                btn.classList.remove('active');
            } else {
                activeTiers.add(tier);
                btn.classList.add('active');
            }
            applyFilters();
        });
    });
    
    // Electron에서 플랜 데이터 수신
    if (window.electronAPI) {
        window.electronAPI.onLoadPlan((plan) => {
            console.log('플랜 데이터 수신:', plan);
            loadPlan(plan);
        });
    }
}

// =====================
// 설정 관련
// =====================

async function loadSettings() {
    if (!window.electronAPI) return;
    
    try {
        const opacity = await window.electronAPI.getOpacity();
        document.getElementById('opacity-slider').value = opacity * 100;
        document.getElementById('opacity-value').textContent = Math.round(opacity * 100) + '%';
        
        const alwaysOnTop = await window.electronAPI.getAlwaysOnTop();
        document.getElementById('always-on-top-check').checked = alwaysOnTop;
    } catch (e) {
        console.error('설정 로드 실패:', e);
    }
}

function toggleSettingsPanel() {
    const panel = document.getElementById('settings-panel');
    panel.classList.toggle('hidden');
}

function handleOpacityChange(e) {
    const value = e.target.value;
    document.getElementById('opacity-value').textContent = value + '%';
    if (window.electronAPI) {
        window.electronAPI.setOpacity(value / 100);
    }
}

function handleAlwaysOnTopChange(e) {
    if (window.electronAPI) {
        window.electronAPI.setAlwaysOnTop(e.target.checked);
    }
}

// 클릭 무시 상태 추적
let isClickThroughEnabled = false;

function handleClickThroughChange(e) {
    isClickThroughEnabled = e.target.checked;
    if (window.electronAPI) {
        window.electronAPI.setClickThrough(isClickThroughEnabled);
    }
}

function handleLockWindowChange(e) {
    const locked = e.target.checked;
    if (window.electronAPI) {
        window.electronAPI.setLocked(locked);
    }
    // body에 클래스 추가/제거 (Aero Shake 방지용)
    if (locked) {
        document.body.classList.add('window-locked');
    } else {
        document.body.classList.remove('window-locked');
    }
}

// 클릭 무시 모드에서도 타이틀바와 설정 패널은 클릭 가능하게
document.addEventListener('mousemove', (e) => {
    if (!isClickThroughEnabled || !window.electronAPI) return;
    
    // 마우스가 타이틀바나 설정 패널 위에 있는지 확인
    const titleBar = document.querySelector('.title-bar');
    const settingsPanel = document.getElementById('settings-panel');
    
    const isOverTitleBar = titleBar && titleBar.contains(e.target);
    const isOverSettingsPanel = settingsPanel && !settingsPanel.classList.contains('hidden') && settingsPanel.contains(e.target);
    
    if (isOverTitleBar || isOverSettingsPanel) {
        // 이 영역에서는 클릭 허용
        window.electronAPI.setClickThrough(false);
    } else {
        // 다른 영역에서는 클릭 무시
        window.electronAPI.setClickThrough(true);
    }
});

// =====================
// 플랜 로드 및 표시
// =====================

function loadPlan(plan) {
    // 먼저 획득 상태를 완전히 초기화
    acquiredGifts = new Set();
    manuallyAcquiredGifts = new Set();
    
    // 플랜 데이터 설정
    currentPlan = plan;
    
    // 데이터 추출
    floorTargets = plan.floorTargets || [];
    startingGifts = plan.startingGifts || [];
    generalGifts = plan.generalGifts || [];
    allGiftsData = plan.allGifts || [];
    synthesisIds = new Set(plan.synthesisIds || []);
    totalFloors = floorTargets.length;
    currentFloorIndex = -1;
    
    // 이 플랜의 저장된 선택 상태 복원
    loadSelectionState();
    
    // 합성 재료 맵 구축
    buildSynthesisIngredientsMap(plan);
    
    // 필터 초기화
    activeKeywords.clear();
    activeTiers.clear();
    searchQuery = '';
    document.getElementById('giftSearchInput').value = '';
    document.querySelectorAll('.filter-btn.active, .tier-quick-btn.active').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // UI 업데이트
    document.getElementById('no-plan-view').classList.add('hidden');
    document.getElementById('plan-view').classList.remove('hidden');
    
    // 헤더 업데이트
    document.getElementById('planName').textContent = plan.name || '플랜';
    document.getElementById('appTitle').textContent = plan.name || '림버스 플랜 실행기';
    
    const difficultyEl = document.getElementById('planDifficulty');
    const difficulty = plan.difficulty || 'normal';
    difficultyEl.textContent = difficulty.toUpperCase();
    difficultyEl.className = 'difficulty ' + difficulty;
    
    const descEl = document.getElementById('planDescription');
    if (plan.description) {
        // 펼치기/접기 구조로 변경
        descEl.innerHTML = `
            <button class="description-toggle" onclick="togglePlanDescription()">
                <span>플랜 설명</span>
                <i class="fa-solid fa-chevron-down"></i>
            </button>
            <div class="description-content">
                <div class="plan-description">${escapeHtml(plan.description)}</div>
            </div>
        `;
        descEl.classList.remove('hidden');
    } else {
        descEl.classList.add('hidden');
    }
    
    // 획득 순서 렌더링
    renderAcquisitionOrder(plan.acquisitionOrder || []);
    
    // 현재 층 표시
    updateFloorDisplay();
    
    // 전체 기프트 목록 렌더링
    renderAllGifts();
}

// =====================
// 획득 순서 렌더링
// =====================

function renderAcquisitionOrder(acquisitionOrder) {
    const container = document.getElementById('acquisitionOrderContent');
    
    if (!acquisitionOrder || acquisitionOrder.length === 0) {
        container.innerHTML = '<div class="empty-message">획득 순서가 없습니다</div>';
        return;
    }
    
    let html = '';
    acquisitionOrder.forEach((row, index) => {
        if (!row.priorities || row.priorities.length === 0) return;
        
        html += '<div class="order-row">';
        html += `<span class="row-num">${index + 1}.</span>`;
        html += '<div class="priority-group">';
        
        row.priorities.forEach((priority, pIndex) => {
            if (pIndex > 0) {
                html += '<span class="priority-separator">→</span>';
            }
            
            priority.forEach(gift => {
                const iconUrl = getKeywordIconUrl(gift.keyword);
                const giftId = gift.id || '';
                html += `<span class="order-gift-item" data-gift-id="${giftId}" data-gift-name="${gift.name}">`;
                if (iconUrl) {
                    html += `<img class="order-keyword-icon" src="${iconUrl}" alt="${gift.keyword}" onerror="this.style.display='none'">`;
                }
                html += `<span class="order-gift-name">${gift.name}</span>`;
                html += '</span>';
            });
        });
        
        html += '</div></div>';
    });
    
    container.innerHTML = html || '<div class="empty-message">획득 순서가 없습니다</div>';
}

// =====================
// 층 표시
// =====================

function changeFloor(delta) {
    const newIndex = currentFloorIndex + delta;
    if (newIndex < -1 || newIndex >= totalFloors) return;
    currentFloorIndex = newIndex;
    updateFloorDisplay();
}

function updateFloorDisplay() {
    const indicator = document.getElementById('floorIndicator');
    const content = document.getElementById('floorContent');
    const prevBtn = document.getElementById('prevFloorBtn');
    const nextBtn = document.getElementById('nextFloorBtn');
    
    prevBtn.disabled = currentFloorIndex <= -1;
    nextBtn.disabled = currentFloorIndex >= totalFloors - 1;
    
    if (currentFloorIndex === -1) {
        // 시작 기프트 페이지
        indicator.textContent = '시작 기프트';
        content.innerHTML = generateStartingGiftsHTML();
    } else {
        // 층 페이지
        const floor = floorTargets[currentFloorIndex];
        indicator.textContent = floor.number + '층';
        content.innerHTML = generateFloorHTML(floor);
    }
    
    // 획득 상태 UI 업데이트
    updateAcquiredUI();
}

function generateStartingGiftsHTML() {
    if (startingGifts.length === 0) {
        return '<div class="empty-message">시작 기프트가 없습니다</div>';
    }
    
    let html = '<div class="floor-gifts-container">';
    
    // 시작 기프트만 표시
    startingGifts.forEach(gift => {
        html += createGiftCardHTML(gift, false, true);
    });
    
    html += '</div>';
    return html;
}

function generateFloorHTML(floor) {
    let html = '';
    
    // 팩 정보
    if (floor.packName) {
        html += '<div class="floor-pack-info">';
        if (floor.packImage) {
            html += `<img class="floor-pack-img" src="${getPackImageUrl(floor.packImage)}" onerror="this.style.display='none'">`;
        }
        html += `<span class="floor-pack-name">${floor.packName}</span>`;
        html += '</div>';
    }
    
    // 목표 기프트
    if (floor.gifts && floor.gifts.length > 0) {
        html += '<div class="floor-gifts-container">';
        floor.gifts.forEach(g => {
            html += createGiftCardHTML(g, false, true);
        });
        html += '</div>';
    } else {
        html += '<div class="empty-message">목표 기프트 없음</div>';
    }
    
    // 합성 기프트
    if (floor.synthesisGifts && floor.synthesisGifts.length > 0) {
        html += '<div style="margin-top: 8px;"><div class="section-title" style="font-size: 0.75em;">합성 기프트</div>';
        html += '<div class="floor-gifts-container">';
        floor.synthesisGifts.forEach(g => {
            html += createGiftCardHTML(g, true, true);
        });
        html += '</div></div>';
    }
    
    // 메모
    if (floor.memo) {
        html += `<div class="floor-memo-wrapper">
            <button class="floor-memo-toggle" onclick="toggleFloorMemo(this)">
                <span>층 설명</span>
                <i class="fa-solid fa-chevron-down"></i>
            </button>
            <div class="floor-memo-content">
                <div class="floor-memo">${escapeHtml(floor.memo)}</div>
            </div>
        </div>`;
    }
    
    return html;
}

// =====================
// 기프트 카드 생성
// =====================

function createGiftCardHTML(gift, isSynthesis = false, isSmall = false) {
    const tierClass = gift.tier ? (gift.tier.toString().toUpperCase() === 'EX' ? 'tier-EX' : 'tier-' + gift.tier) : '';
    const sizeClass = isSmall ? ' size-tiny' : ' size-small';
    const keyword = gift.keyword || (gift.tags && gift.tags[0]) || '';
    const keywordIconUrl = getKeywordIconUrl(keyword);
    const imageUrl = getGiftImageUrl(gift.image);
    
    // keyword와 keywords를 모두 포함
    const allKeywords = [keyword, ...(gift.keywords || [])].filter(k => k);
    
    // 합성 여부와 관계없이 동일한 스타일 사용 (합성 뱃지 제거)
    let html = `<div class="unified-gift-card${sizeClass}" data-gift-id="${gift.id || ''}" data-keywords="${allKeywords.join(',')}" data-tier="${gift.tier || ''}">`;
    html += `<span class="ugc-tier-badge ${tierClass}">${getRomanNumeral(gift.tier)}</span>`;
    
    // 이름만 보기용 속성 아이콘 (image-container 밖에 위치)
    if (keywordIconUrl) {
        html += `<span class="ugc-keyword-icon"><img src="${keywordIconUrl}" alt="${keyword}" onerror="this.style.display='none'"></span>`;
    }
    
    html += '<div class="ugc-image-container">';
    html += '<div class="ugc-image-placeholder">';
    if (imageUrl) {
        html += `<img src="${imageUrl}" alt="${gift.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23333%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23666%22 font-size=%2214%22>?</text></svg>'">`;
    }
    html += '</div>';
    
    if (keywordIconUrl) {
        html += `<span class="ugc-attribute-icon"><img src="${keywordIconUrl}" alt="${keyword}" onerror="this.style.display='none'"></span>`;
    }
    
    html += '</div>';
    html += `<span class="ugc-name">${gift.name}</span>`;
    html += '</div>';
    
    return html;
}

// =====================
// 전체 기프트 목록
// =====================

function renderAllGifts() {
    const grid = document.getElementById('allGiftsGrid');
    
    if (allGiftsData.length === 0) {
        grid.innerHTML = '<div class="empty-message">기프트가 없습니다</div>';
        return;
    }
    
    let html = '';
    allGiftsData.forEach(gift => {
        const isSynthesis = synthesisIds.has(gift.id);
        html += createGiftCardHTML(gift, isSynthesis, false);
    });
    
    grid.innerHTML = html;
}

function applyFilters() {
    const cards = document.querySelectorAll('#allGiftsGrid .unified-gift-card');
    
    cards.forEach(card => {
        const keywords = (card.dataset.keywords || '').split(',').filter(k => k);
        const tier = card.dataset.tier;
        const name = card.querySelector('.ugc-name')?.textContent || '';
        
        let visible = true;
        
        // 검색어 필터
        if (searchQuery && !name.toLowerCase().includes(searchQuery.toLowerCase())) {
            visible = false;
        }
        
        // 키워드 필터
        if (visible && activeKeywords.size > 0) {
            const hasKeyword = [...activeKeywords].some(kw => keywords.includes(kw));
            if (!hasKeyword) visible = false;
        }
        
        // 등급 필터
        if (visible && activeTiers.size > 0) {
            const tierStr = tier ? tier.toString().toUpperCase() : '';
            if (!activeTiers.has(tierStr) && !activeTiers.has(tier)) {
                visible = false;
            }
        }
        
        card.classList.toggle('hidden', !visible);
    });
}

// =====================
// 합성 재료 맵 구축
// =====================

function buildSynthesisIngredientsMap(plan) {
    synthesisIngredientsMap.clear();
    
    // 층별 합성 기프트에서 재료 정보 추출
    if (plan.floorTargets) {
        plan.floorTargets.forEach(floor => {
            if (floor.synthesisGifts) {
                floor.synthesisGifts.forEach(synGift => {
                    if (synGift.id && synGift.ingredients && synGift.ingredients.length > 0) {
                        // ingredients가 기프트 ID 배열이라고 가정
                        synthesisIngredientsMap.set(synGift.id, synGift.ingredients);
                    }
                });
            }
        });
    }
    
    // 일반 목표 기프트에서 합성 기프트 재료 정보 추출
    if (plan.generalGifts) {
        plan.generalGifts.forEach(gift => {
            if (gift.id && gift.ingredients && gift.ingredients.length > 0) {
                synthesisIngredientsMap.set(gift.id, gift.ingredients);
            }
        });
    }
    
    console.log('합성 재료 맵 구축 완료:', synthesisIngredientsMap.size, '개');
}

// =====================
// 기프트 획득 토글
// =====================

function toggleGiftAcquired(giftId) {
    if (!giftId) return;
    
    // giftId를 숫자로 변환 (비교 일관성)
    const numGiftId = typeof giftId === 'string' ? parseInt(giftId) : giftId;
    
    const isSynthesis = synthesisIds.has(numGiftId);
    const ingredientIds = synthesisIngredientsMap.get(numGiftId) || [];
    
    console.log('toggleGiftAcquired:', numGiftId, 'isSynthesis:', isSynthesis, 'ingredients:', ingredientIds);
    
    // 현재 획득 상태 확인
    const isCurrentlyAcquired = acquiredGifts.has(numGiftId);
    
    if (isCurrentlyAcquired) {
        // 획득 해제
        acquiredGifts.delete(numGiftId);
        manuallyAcquiredGifts.delete(numGiftId);
        
        // 합성 기프트면 재료들도 함께 해제 (단, 수동 선택한 것은 유지)
        if (isSynthesis && ingredientIds.length > 0) {
            ingredientIds.forEach(ingId => {
                // 사용자가 직접 선택한 재료는 유지
                if (!manuallyAcquiredGifts.has(ingId)) {
                    acquiredGifts.delete(ingId);
                }
            });
        }
    } else {
        // 획득 표시
        acquiredGifts.add(numGiftId);
        manuallyAcquiredGifts.add(numGiftId); // 직접 클릭한 것 기록
        
        // 합성 기프트면 재료들도 함께 획득 표시
        if (isSynthesis && ingredientIds.length > 0) {
            ingredientIds.forEach(ingId => {
                acquiredGifts.add(ingId);
                // 재료는 자동 선택이므로 manuallyAcquiredGifts에 추가하지 않음
            });
        }
    }
    
    // UI 업데이트
    updateAcquiredUI();
    
    // localStorage에 저장
    saveSelectionState();
}

function updateAcquiredUI() {
    // 모든 기프트 카드의 획득 상태 업데이트
    document.querySelectorAll('.unified-gift-card').forEach(card => {
        const giftId = card.dataset.giftId;
        if (giftId) {
            const numGiftId = parseInt(giftId);
            card.classList.toggle('acquired', acquiredGifts.has(numGiftId));
        }
    });
    
    // 획득 순서 영역의 기프트도 업데이트
    document.querySelectorAll('.order-gift-item').forEach(item => {
        const giftId = item.dataset.giftId;
        const name = item.dataset.giftName || item.querySelector('.order-gift-name')?.textContent;
        
        // ID가 있으면 ID로 매칭, 없으면 이름으로 매칭
        let isAcquired = false;
        if (giftId) {
            const numGiftId = parseInt(giftId);
            if (acquiredGifts.has(numGiftId)) {
                isAcquired = true;
            }
        } else if (name) {
            const gift = allGiftsData.find(g => g.name === name);
            if (gift && acquiredGifts.has(gift.id)) {
                isAcquired = true;
            }
        }
        
        item.classList.toggle('acquired', isAcquired);
    });
}

// 기프트 카드 및 획득 순서 클릭 이벤트 위임 (이벤트 버블링 활용)
document.addEventListener('click', (e) => {
    // 기프트 카드 클릭
    const card = e.target.closest('.unified-gift-card');
    if (card) {
        const giftId = card.dataset.giftId;
        if (giftId) {
            toggleGiftAcquired(giftId);
            return;
        }
    }
    
    // 획득 순서 영역의 기프트 아이템 클릭
    const orderItem = e.target.closest('.order-gift-item');
    if (orderItem) {
        let giftId = orderItem.dataset.giftId;
        
        // ID가 없으면 이름으로 찾기
        if (!giftId) {
            const name = orderItem.dataset.giftName || orderItem.querySelector('.order-gift-name')?.textContent;
            if (name) {
                const gift = allGiftsData.find(g => g.name === name);
                if (gift) giftId = gift.id;
            }
        }
        
        if (giftId) {
            toggleGiftAcquired(giftId);
        }
    }
});

// =====================
// 선택 상태 저장/로드/초기화
// =====================

function getStorageKey() {
    // 플랜 이름 + 난이도 + 기프트 수 조합으로 고유 키 생성
    if (!currentPlan) return 'limbus_selection_default';
    const planName = currentPlan.name || 'unnamed';
    const difficulty = currentPlan.difficulty || 'normal';
    const giftCount = (currentPlan.allGifts || []).length;
    // 특수문자 제거하고 키 생성
    const safeName = planName.replace(/[^a-zA-Z0-9가-힣]/g, '_');
    return `limbus_selection_${safeName}_${difficulty}_${giftCount}`;
}

function saveSelectionState() {
    if (!currentPlan) return;
    
    const state = {
        acquired: Array.from(acquiredGifts),
        manual: Array.from(manuallyAcquiredGifts)
    };
    
    try {
        localStorage.setItem(getStorageKey(), JSON.stringify(state));
    } catch (e) {
        console.error('선택 상태 저장 실패:', e);
    }
}

function loadSelectionState() {
    if (!currentPlan) return;
    
    try {
        const saved = localStorage.getItem(getStorageKey());
        if (saved) {
            const state = JSON.parse(saved);
            acquiredGifts = new Set(state.acquired || []);
            manuallyAcquiredGifts = new Set(state.manual || []);
            console.log('선택 상태 복원:', acquiredGifts.size, '개');
        }
    } catch (e) {
        console.error('선택 상태 로드 실패:', e);
    }
}

function resetAllSelections() {
    acquiredGifts.clear();
    manuallyAcquiredGifts.clear();
    
    // localStorage에서도 삭제
    if (currentPlan) {
        try {
            localStorage.removeItem(getStorageKey());
        } catch (e) {
            console.error('선택 상태 삭제 실패:', e);
        }
    }
    
    // UI 업데이트
    updateAcquiredUI();
    
    console.log('모든 선택이 초기화되었습니다');
}

function showResetConfirmModal() {
    document.getElementById('confirm-reset-modal').classList.remove('hidden');
}

function hideResetConfirmModal() {
    document.getElementById('confirm-reset-modal').classList.add('hidden');
}

// =====================
// 표시 모드 전환
// =====================

let currentViewMode = null; // null, 'name', 'image'

function toggleViewMode(mode) {
    const nameBtn = document.getElementById('view-mode-name');
    const imageBtn = document.getElementById('view-mode-image');
    
    // 같은 모드를 다시 클릭하면 해제
    if (currentViewMode === mode) {
        document.body.classList.remove('view-mode-name', 'view-mode-image');
        nameBtn.classList.remove('active');
        imageBtn.classList.remove('active');
        currentViewMode = null;
    } else {
        // 다른 모드 선택
        document.body.classList.remove('view-mode-name', 'view-mode-image');
        nameBtn.classList.remove('active');
        imageBtn.classList.remove('active');
        
        document.body.classList.add('view-mode-' + mode);
        if (mode === 'name') {
            nameBtn.classList.add('active');
        } else {
            imageBtn.classList.add('active');
        }
        currentViewMode = mode;
    }
}
