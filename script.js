document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendar');
    const body = document.body;
    
    // CẤU HÌNH GOOGLE SHEETS BẰNG 2 TAB RIÊNG BIỆT
    const SPREADSHEET_ID = '1F4ycI6FcyZzNqBkf7ahbFBiDn8XyHDb1TYgcdsQ-FzE';
    const SHEET_EVENTS = 'ngắn hạn'; 
    const SHEET_DEADLINES = 'dài hạn';
    
    const URL_EVENTS = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?sheet=${encodeURIComponent(SHEET_EVENTS)}&tqx=out:json`;
    const URL_DEADLINES = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?sheet=${encodeURIComponent(SHEET_DEADLINES)}&tqx=out:json`;

    // Khởi tạo các biến Modal
    const modal = document.getElementById('event-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalDate = document.getElementById('modal-date');
    const modalDesc = document.getElementById('modal-description');
    const modalAccent = document.getElementById('modal-accent');

    // MẶC ĐỊNH KHÓA CHẾ ĐỘ TỐI
    body.classList.add('dark');

    // HÀM RENDER KHỐI DEADLINE DÀI HẠN BÊN PHẢI (CHẾ ĐỘ 6 CỘT)
    function renderLongTermDeadlines(deadlines) {
        const container = document.getElementById('deadline-list');
        container.innerHTML = ''; 

        if (deadlines.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col justify-center items-center h-full text-slate-400 dark:text-slate-500 opacity-70">
                    <span class="text-4xl mb-3">☕</span>
                    <p class="text-sm font-medium">Chưa có mục tiêu dài hạn nào.</p>
                </div>`;
            return;
        }

        // --- SẮP XẾP: ƯU TIÊN THEO TRẠNG THÁI TRƯỚC, NGÀY THÁNG SAU ---
        deadlines.sort((a, b) => {
            const isADone = a.status === 'Hoàn thành';
            const isBDone = b.status === 'Hoàn thành';

            if (isADone && !isBDone) return 1;
            if (!isADone && isBDone) return -1;

            const dateA = new Date(a.rawEnd || a.start);
            const dateB = new Date(b.rawEnd || b.start);
            return (isNaN(dateA) ? 0 : dateA) - (isNaN(dateB) ? 0 : dateB);
        });

        deadlines.forEach(item => {
            const isDone = item.status === 'Hoàn thành';
            const inProgress = item.status === 'Đang làm' || (item.status && item.status.toLowerCase() === 'đang hoàn thành');
            
            const today = new Date();
            today.setHours(0,0,0,0);
            
            const startDate = new Date(item.start);
            startDate.setHours(0,0,0,0);
            
            const endDate = new Date(item.rawEnd || item.start);
            endDate.setHours(0,0,0,0);
            
            let timeText = '';
            let timeColor = '';
            let opacityClass = ''; 
            
            const isDateValid = !isNaN(startDate.getTime());

            if (!isDateValid) {
                timeText = 'Không có ngày';
                timeColor = 'text-slate-400';
            } else if (isDone) {
                timeText = 'Đã xong';
                timeColor = 'text-green-500';
            } else if (today < startDate) {
                // CHƯA BẮT ĐẦU -> Làm mờ thẻ
                const diffStart = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
                timeText = `Chưa tới (${diffStart} ngày nữa)`;
                timeColor = 'text-slate-400 font-medium';
                opacityClass = 'opacity-50 grayscale-[50%]';
            } else if (today > endDate) {
                // QUÁ HẠN
                const diffDays = Math.ceil((today - endDate) / (1000 * 60 * 60 * 24));
                timeText = `Quá hạn ${diffDays} ngày`;
                timeColor = 'text-red-500 font-bold';
            } else {
                // ĐANG TRONG KHOẢNG THỜI GIAN LÀM
                const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                if (diffDays === 0) {
                    timeText = 'Deadline hôm nay!';
                    timeColor = 'text-red-600 font-extrabold animate-pulse';
                } else {
                    timeText = `Còn ${diffDays} ngày`;
                    timeColor = diffDays <= 14 ? 'text-orange-500 font-bold' : 'text-blue-500 font-medium';
                }
            }

            const el = document.createElement('div');
            el.className = `p-4 rounded-xl border ${isDone ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-700 opacity-50' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500'} ${opacityClass} transition-all cursor-pointer group`;
            
            let dateDisplay = isDateValid ? startDate.toLocaleDateString('vi-VN') : 'Không xác định';
            if (isDateValid && item.start !== item.rawEnd && !isNaN(endDate.getTime())) {
                dateDisplay = `${startDate.toLocaleDateString('vi-VN', {day:'numeric', month:'numeric'})} - ${endDate.toLocaleDateString('vi-VN')}`;
            }

            el.innerHTML = `
                <div class="flex justify-between items-start mb-2 gap-2">
                    <h3 class="text-sm font-bold leading-tight ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors'}">${item.title}</h3>
                    <span class="text-[11px] whitespace-nowrap bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md ${timeColor}">${timeText}</span>
                </div>
                <div class="flex items-center gap-2 mt-3">
                    <span class="w-3 h-3 rounded-full shadow-sm ${isDone ? 'opacity-50 grayscale' : ''}" style="background-color: ${item.backgroundColor}"></span>
                    <span class="text-xs text-slate-500 dark:text-slate-400 font-medium ${isDone ? 'line-through opacity-70' : ''}">${dateDisplay}</span>
                    <span class="text-[10px] px-2 py-1 rounded-md ml-auto font-bold uppercase tracking-wider ${isDone ? 'bg-slate-200 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400' : inProgress ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'}">${item.status}</span>
                </div>
            `;
            
            el.onclick = () => {
                modalTitle.innerText = item.title;
                if (isDateValid && item.start !== item.rawEnd && !isNaN(endDate.getTime())) {
                     modalDate.innerText = `Từ ${startDate.toLocaleDateString('vi-VN')} đến ${endDate.toLocaleDateString('vi-VN')}`;
                } else if (isDateValid) {
                     modalDate.innerText = startDate.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                } else {
                     modalDate.innerText = 'Không có thời gian';
                }
                modalDesc.innerText = item.description || "Không có ghi chú chi tiết.";
                modalAccent.style.backgroundColor = item.backgroundColor;
                
                const statusBadge = document.getElementById('modal-status-badge');
                const currentStatus = item.status || 'Chưa làm';
                statusBadge.innerText = currentStatus;
                statusBadge.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider';
                
                if (currentStatus === 'Hoàn thành') statusBadge.classList.add('bg-green-100', 'text-green-700', 'dark:bg-green-900/30', 'dark:text-green-400');
                else if (currentStatus === 'Nợ' || currentStatus.toLowerCase() === 'đang hoàn thành') statusBadge.classList.add('bg-yellow-100', 'text-yellow-700', 'dark:bg-yellow-900/30', 'dark:text-yellow-400');
                else statusBadge.classList.add('bg-slate-100', 'text-slate-600', 'dark:bg-slate-700', 'dark:text-slate-300');
                
                modal.classList.remove('hidden');
            };

            container.appendChild(el);
        });
    }

    function addOneDay(dateString) {
        if (!dateString) return '';
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return ''; 
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    }

    // HÀM CHUẨN HÓA MÃ MÀU
    function getHexColor(colorStr) {
        let finalColor = '#4f46e5'; 
        if (!colorStr) return finalColor;
        
        let rawColor = colorStr.toString().trim();
        const hexMatch = rawColor.match(/#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})/);
        
        if (hexMatch) {
            finalColor = hexMatch[0];
        } else if (/^[a-fA-F0-9]{6}$/.test(rawColor) || /^[a-fA-F0-9]{3}$/.test(rawColor)) {
            finalColor = '#' + rawColor;
        } else {
            const text = rawColor.toLowerCase();
            if (text.includes('đỏ')) finalColor = '#ef4444';
            else if (text.includes('xanh lá')) finalColor = '#10b981';
            else if (text.includes('vàng')) finalColor = '#f59e0b';
            else if (text.includes('cam')) finalColor = '#f97316';
            else if (text.includes('hồng')) finalColor = '#ec4899';
            else if (text.includes('xanh') || text.includes('blue')) finalColor = '#3b82f6';
        }
        return finalColor;
    }

    // HÀM ĐỌC SHEET ĐỘC LẬP (Biến isDeadlineSheet quyết định cấu trúc 5 hay 6 cột)
    function parseSheetData(jsonText, isDeadlineSheet) {
        if(!jsonText) return [];
        const data = JSON.parse(jsonText.substring(47).slice(0, -2));
        if(!data.table || !data.table.rows) return [];
        
        return data.table.rows.map(row => {
            const cells = row.c;
            if (!cells) return null;

            let title = cells[0] && cells[0].v !== null ? cells[0].v : 'Sự kiện không tên';
            let startDateRaw = cells[1] ? cells[1].v : '';
            let startDate = formatGoogleDate(startDateRaw);
            
            let endDateRaw = '', descStr = '', colorStr = '', statusStr = 'Chưa làm';

            if (isDeadlineSheet) {
                // Tab Deadline: 6 cột (Có ngày kết thúc ở cột C)
                endDateRaw = cells[2] ? cells[2].v : '';
                descStr = cells[3] ? cells[3].v : '';
                colorStr = cells[4] ? cells[4].v : '';
                statusStr = cells[5] ? cells[5].v : 'Chưa làm';
            } else {
                // Tab Sự kiện ngắn hạn (Lịch bên trái): 5 cột cũ
                endDateRaw = startDateRaw; // Bắt đầu bằng kết thúc, sự kiện diễn ra trong 1 ngày
                descStr = cells[2] ? cells[2].v : '';
                colorStr = cells[3] ? cells[3].v : '';
                statusStr = cells[4] ? cells[4].v : 'Chưa làm';
            }

            let endDate = formatGoogleDate(endDateRaw) || startDate;
            let finalColor = getHexColor(colorStr);

            return {
                title: title,
                start: startDate,
                end: (isDeadlineSheet && endDate !== startDate) ? addOneDay(endDate) : '', 
                rawEnd: endDate, 
                description: descStr,
                backgroundColor: finalColor,
                status: statusStr,
                allDay: true
            };
        }).filter(item => item !== null);
    }

    // LẤY DỮ LIỆU TỪ 2 TAB
    async function fetchEventsFromSheets(info, successCallback, failureCallback) {
        try {
            const [resEvents, resDeadlines] = await Promise.all([
                fetch(URL_EVENTS),
                fetch(URL_DEADLINES)
            ]);

            const textEvents = await resEvents.text();
            const textDeadlines = await resDeadlines.text();
            
            // Tab sự kiện: 5 cột (false) | Tab Deadline: 6 cột (true)
            const calendarEvents = parseSheetData(textEvents, false);
            const longTermDeadlines = parseSheetData(textDeadlines, true);

            renderLongTermDeadlines(longTermDeadlines);
            
            // Chỉ hiển thị calendarEvents lên lịch bên trái
            successCallback(calendarEvents);
        } catch (error) {
            console.error("Lỗi đồng bộ dữ liệu:", error);
            document.getElementById('deadline-list').innerHTML = '<p class="text-red-500 text-center text-sm mt-5">Lỗi tải dữ liệu. Hãy kiểm tra lại file Sheets.</p>';
            successCallback([]); 
        }
    }

    function formatGoogleDate(dateStr) {
        if (!dateStr || typeof dateStr !== 'string') return dateStr;
        if (dateStr.startsWith('Date')) {
            const parts = dateStr.match(/\d+/g);
            return `${parts[0]}-${(parseInt(parts[1]) + 1).toString().padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
        return dateStr;
    }

    // CẤU HÌNH LỊCH BÊN TRÁI (KHÔNG CÓ CHẾ ĐỘ MỜ "event-not-started")
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: window.innerWidth < 768 ? 'listMonth' : 'dayGridMonth',
        locale: 'vi',
        firstDay: 1,
        height: 'auto',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,listMonth' 
        },
        buttonText: { today: 'Hôm nay', month: 'Tháng', list: 'Danh sách' },
        events: fetchEventsFromSheets,
        eventClassNames: function(arg) {
            const classes = [];
            const status = arg.event.extendedProps.status;
            
            if (status === 'Hoàn thành') classes.push('event-completed');
            if (status === 'Nợ' || (status && status.toLowerCase() === 'đang hoàn thành')) classes.push('event-in-progress');

            // Đã loại bỏ logic làm mờ sự kiện (today < startDate) ở đây theo yêu cầu

            return classes;
        },
        eventClick: function(info) {
            modalTitle.innerText = info.event.title;
            
            // Lịch ngắn hạn nên đa số chỉ hiển thị ngày bắt đầu
            modalDate.innerText = info.event.start.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            
            modalDesc.innerText = info.event.extendedProps.description || "Chưa có thông tin ghi chú.";
            modalAccent.style.backgroundColor = info.event.backgroundColor;
            
            const statusBadge = document.getElementById('modal-status-badge');
            const currentStatus = info.event.extendedProps.status || 'Chưa làm';
            statusBadge.innerText = currentStatus;
            statusBadge.className = 'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider';
            
            if (currentStatus === 'Hoàn thành') statusBadge.classList.add('bg-green-100', 'text-green-700', 'dark:bg-green-900/30', 'dark:text-green-400');
            else if (currentStatus === 'Nợ' || currentStatus.toLowerCase() === 'đang hoàn thành') statusBadge.classList.add('bg-yellow-100', 'text-yellow-700', 'dark:bg-yellow-900/30', 'dark:text-yellow-400');
            else statusBadge.classList.add('bg-slate-100', 'text-slate-600', 'dark:bg-slate-700', 'dark:text-slate-300');
            
            modal.classList.remove('hidden');
        },
        windowResize: function() {
            calendar.changeView(window.innerWidth < 768 ? 'listMonth' : 'dayGridMonth');
        }
    });

    calendar.render();

    // HÀM ĐÓNG MODAL
    const closeModal = () => modal.classList.add('hidden');
    document.getElementById('close-modal').onclick = closeModal;
    document.getElementById('modal-overlay').onclick = closeModal;
    document.getElementById('btn-confirm').onclick = closeModal;
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
});