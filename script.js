document.addEventListener('DOMContentLoaded', function () {
    const calendarEl = document.getElementById('calendar');
    const body = document.body;

    // GOOGLE SHEETS
    const SPREADSHEET_ID = '1F4ycI6FcyZzNqBkf7ahbFBiDn8XyHDb1TYgcdsQ-FzE';
    const SHEET_EVENTS = 'CALENDAR';
    const SHEET_DEADLINES = 'LONGTERM';

    const URL_EVENTS = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?sheet=${encodeURIComponent(SHEET_EVENTS)}&tqx=out:json`;
    const URL_DEADLINES = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?sheet=${encodeURIComponent(SHEET_DEADLINES)}&tqx=out:json`;

    // UI ELEMENTS
    const modal = document.getElementById('event-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalDate = document.getElementById('modal-date');
    const modalDesc = document.getElementById('modal-description');
    const modalAccent = document.getElementById('modal-accent');
    const statusBadge = document.getElementById('modal-status-badge');

    const syncDot = document.getElementById('sync-dot');
    const syncLabel = document.getElementById('sync-label');
    const syncTime = document.getElementById('sync-time');
    const syncToast = document.getElementById('sync-toast');
    const syncToastText = document.getElementById('sync-toast-text');

    const deadlineCount = document.getElementById('deadline-count');
    const deadlineProgressText = document.getElementById('deadline-progress-text');
    const deadlineProgressMeta = document.getElementById('deadline-progress-meta');
    const deadlineProgressBar = document.getElementById('deadline-progress-bar');

    body.classList.add('dark');

    function normalizeStatus(status) {
        return String(status || 'Chưa làm').trim();
    }

    function statusType(status) {
        const normalized = normalizeStatus(status).toLowerCase();
        if (normalized === 'hoàn thành') return 'done';
        if (normalized === 'nợ') return 'debt';
        if (normalized === 'đang làm' || normalized === 'đang hoàn thành') return 'progress';
        return 'default';
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function setSyncState(state, text) {
        syncDot.classList.remove('is-loading', 'is-error');

        if (state === 'loading') {
            syncDot.classList.add('is-loading');
            syncLabel.textContent = 'Đang đồng bộ';
            syncTime.textContent = 'Google Sheets';
        } else if (state === 'error') {
            syncDot.classList.add('is-error');
            syncLabel.textContent = 'Lỗi đồng bộ';
            syncTime.textContent = text || 'Kiểm tra quyền Sheet';
        } else {
            const now = new Date();
            syncLabel.textContent = 'Đã đồng bộ';
            syncTime.textContent = `Lúc ${now.toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit'
            })}`;
        }
    }

    let toastTimer;

    function showToast(message) {
        syncToastText.textContent = message;
        syncToast.classList.add('show');

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            syncToast.classList.remove('show');
        }, 2400);
    }

    function updateDeadlineSummary(deadlines) {
        const total = deadlines.length;

        const done = deadlines.filter(
            item => statusType(item.status) === 'done'
        ).length;

        const percentage = total
            ? Math.round((done / total) * 100)
            : 0;

        deadlineCount.textContent = `${total} mục tiêu`;
        deadlineProgressText.textContent = `${percentage}%`;
        deadlineProgressMeta.textContent = `${done} / ${total} hoàn thành`;

        requestAnimationFrame(() => {
            deadlineProgressBar.style.width = `${percentage}%`;
        });
    }

    function getTimelineProgress(startDate, endDate, isDone) {
        if (isDone) return 100;

        if (
            isNaN(startDate.getTime()) ||
            isNaN(endDate.getTime())
        ) {
            return 0;
        }

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        if (now <= startDate) return 0;
        if (now >= endDate) return 100;

        const total = Math.max(1, endDate - startDate);
        const elapsed = now - startDate;

        return Math.max(
            0,
            Math.min(
                100,
                Math.round((elapsed / total) * 100)
            )
        );
    }

    function renderLongTermDeadlines(deadlines) {
        const container = document.getElementById('deadline-list');

        container.innerHTML = '';

        updateDeadlineSummary(deadlines);

        if (deadlines.length === 0) {
            container.innerHTML = `
                <div class="deadline-empty">
                    <div>
                        <strong>Chưa có mục tiêu dài hạn</strong>
                        <span>Thêm dữ liệu trong tab Deadline của Google Sheets.</span>
                    </div>
                </div>
            `;

            return;
        }

        // Sắp xếp:
        // chưa hoàn thành trước
        // hoàn thành xuống cuối
        // sau đó sort theo deadline
        deadlines.sort((a, b) => {
            const aDone = statusType(a.status) === 'done';
            const bDone = statusType(b.status) === 'done';

            if (aDone && !bDone) return 1;
            if (!aDone && bDone) return -1;

            const dateA = new Date(a.rawEnd || a.start);
            const dateB = new Date(b.rawEnd || b.start);

            return (
                (isNaN(dateA) ? 0 : dateA) -
                (isNaN(dateB) ? 0 : dateB)
            );
        });

        deadlines.forEach((item, index) => {
            const type = statusType(item.status);
            const isDone = type === 'done';

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const startDate = new Date(item.start);
            startDate.setHours(0, 0, 0, 0);

            const endDate = new Date(
                item.rawEnd || item.start
            );

            endDate.setHours(0, 0, 0, 0);

            const isDateValid =
                !isNaN(startDate.getTime());

            const isEndDateValid =
                !isNaN(endDate.getTime());

            let timeText = 'Không có ngày';
            let timeClass = '';
            let stateClass = '';

            if (isDone) {
                timeText = 'Đã xong';
                timeClass = 'is-success';
                stateClass = 'is-done';
            }

            else if (
                isDateValid &&
                today < startDate
            ) {
                const diffStart = Math.ceil(
                    (startDate - today) / 86400000
                );

                timeText =
                    `Còn ${diffStart} ngày để bắt đầu`;

                stateClass = 'is-future';
            }

            else if (
                isDateValid &&
                isEndDateValid &&
                today > endDate
            ) {
                const diffDays = Math.ceil(
                    (today - endDate) / 86400000
                );

                timeText =
                    `Quá hạn ${diffDays} ngày`;

                timeClass = 'is-danger';
                stateClass = 'is-overdue';
            }

            else if (
                isDateValid &&
                isEndDateValid
            ) {
                const diffDays = Math.ceil(
                    (endDate - today) / 86400000
                );

                if (diffDays <= 0) {
                    timeText = 'Deadline hôm nay';
                    timeClass = 'is-danger';
                } else {
                    timeText = `Còn ${diffDays} ngày`;

                    if (diffDays <= 14) {
                        timeClass = 'is-warning';
                    }
                }
            }

            let dateDisplay = isDateValid
                ? startDate.toLocaleDateString('vi-VN')
                : 'Không xác định';

            if (
                isDateValid &&
                isEndDateValid &&
                item.start !== item.rawEnd
            ) {
                dateDisplay =
                    `${startDate.toLocaleDateString(
                        'vi-VN',
                        {
                            day: '2-digit',
                            month: '2-digit'
                        }
                    )} → ${endDate.toLocaleDateString(
                        'vi-VN',
                        {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                        }
                    )}`;
            }

            const progress =
                getTimelineProgress(
                    startDate,
                    endDate,
                    isDone
                );

            const el =
                document.createElement('div');

            el.className =
                `deadline-item ${stateClass}`;

            el.style.setProperty(
                '--i',
                index
            );

            el.style.setProperty(
                '--deadline-color',
                item.backgroundColor || '#7c83ff'
            );

            const statusClass =
                type === 'progress'
                    ? 'progress'
                    : type === 'done'
                        ? 'done'
                        : type === 'debt'
                            ? 'debt'
                            : '';

            el.innerHTML = `
                <div class="deadline-item-top">

                    <h3 class="deadline-title">
                        ${escapeHtml(item.title)}
                    </h3>

                    <span class="deadline-time-pill ${timeClass}">
                        ${escapeHtml(timeText)}
                    </span>

                </div>

                <div class="deadline-meta">

                    <span
                        class="deadline-color-dot"
                        style="background:${escapeHtml(item.backgroundColor)}">
                    </span>

                    <span class="deadline-date">
                        ${escapeHtml(dateDisplay)}
                    </span>

                    <span class="deadline-status ${statusClass}">
                        ${escapeHtml(normalizeStatus(item.status))}
                    </span>

                </div>

                <div
                    class="deadline-mini-progress"
                    title="Tiến độ thời gian">

                    <span style="width:${progress}%"></span>

                </div>
            `;

            el.addEventListener('click', () => {
                let dateText =
                    'Không có thời gian';

                if (
                    isDateValid &&
                    isEndDateValid &&
                    item.start !== item.rawEnd
                ) {
                    dateText =
                        `Từ ${startDate.toLocaleDateString(
                            'vi-VN'
                        )} đến ${endDate.toLocaleDateString(
                            'vi-VN'
                        )}`;
                }

                else if (isDateValid) {
                    dateText =
                        startDate.toLocaleDateString(
                            'vi-VN',
                            {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            }
                        );
                }

                openModal({
                    title: item.title,
                    date: dateText,
                    description:
                        item.description ||
                        'Không có ghi chú chi tiết.',
                    color:
                        item.backgroundColor,
                    status:
                        item.status
                });
            });

            container.appendChild(el);
        });
    }

    function addOneDay(dateString) {
        if (!dateString) return '';

        const d = new Date(dateString);

        if (isNaN(d.getTime())) return '';

        d.setDate(d.getDate() + 1);

        return d
            .toISOString()
            .split('T')[0];
    }

    // Chuẩn hóa màu nhập từ Sheet
    function getHexColor(colorStr) {
        let finalColor = '#5b5ce2';

        if (!colorStr) {
            return finalColor;
        }

        const rawColor =
            colorStr
                .toString()
                .trim();

        const hexMatch =
            rawColor.match(
                /#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})/
            );

        if (hexMatch) {
            finalColor = hexMatch[0];
        }

        else if (
            /^[a-fA-F0-9]{6}$/.test(rawColor) ||
            /^[a-fA-F0-9]{3}$/.test(rawColor)
        ) {
            finalColor =
                '#' + rawColor;
        }

        else {
            const text =
                rawColor.toLowerCase();

            if (text.includes('đỏ')) {
                finalColor = '#ef5f74';
            }

            else if (
                text.includes('xanh lá')
            ) {
                finalColor = '#2fbf8d';
            }

            else if (
                text.includes('vàng')
            ) {
                finalColor = '#dca347';
            }

            else if (
                text.includes('cam')
            ) {
                finalColor = '#de8955';
            }

            else if (
                text.includes('hồng')
            ) {
                finalColor = '#d65f9e';
            }

            else if (
                text.includes('tím')
            ) {
                finalColor = '#6f6fe8';
            }

            else if (
                text.includes('xanh') ||
                text.includes('blue')
            ) {
                finalColor = '#4f8fcf';
            }
        }

        return finalColor;
    }

    function parseSheetData(
        jsonText,
        isDeadlineSheet
    ) {
        if (!jsonText) return [];

        const start =
            jsonText.indexOf('{');

        const end =
            jsonText.lastIndexOf('}');

        if (
            start === -1 ||
            end === -1
        ) {
            throw new Error(
                'Google Sheets trả về dữ liệu không hợp lệ.'
            );
        }

        const data =
            JSON.parse(
                jsonText.slice(
                    start,
                    end + 1
                )
            );

        if (
            !data.table ||
            !data.table.rows
        ) {
            return [];
        }

        return data.table.rows
            .map(row => {
                const cells = row.c;

                if (!cells) return null;

                const title =
                    cells[0] &&
                    cells[0].v !== null
                        ? cells[0].v
                        : 'Sự kiện không tên';

                const startDateRaw =
                    cells[1]
                        ? cells[1].v
                        : '';

                const startDate =
                    formatGoogleDate(
                        startDateRaw
                    );

                let endDateRaw = '';
                let descStr = '';
                let colorStr = '';
                let statusStr =
                    'Chưa làm';

                // Deadline:
                // A = title
                // B = start
                // C = end
                // D = description
                // E = color
                // F = status
                if (isDeadlineSheet) {
                    endDateRaw =
                        cells[2]
                            ? cells[2].v
                            : '';

                    descStr =
                        cells[3]
                            ? cells[3].v
                            : '';

                    colorStr =
                        cells[4]
                            ? cells[4].v
                            : '';

                    statusStr =
                        cells[5]
                            ? cells[5].v
                            : 'Chưa làm';
                }

                // Event:
                // A = title
                // B = date
                // C = description
                // D = color
                // E = status
                else {
                    endDateRaw =
                        startDateRaw;

                    descStr =
                        cells[2]
                            ? cells[2].v
                            : '';

                    colorStr =
                        cells[3]
                            ? cells[3].v
                            : '';

                    statusStr =
                        cells[4]
                            ? cells[4].v
                            : 'Chưa làm';
                }

                const endDate =
                    formatGoogleDate(
                        endDateRaw
                    ) || startDate;

                const finalColor =
                    getHexColor(
                        colorStr
                    );

                return {
                    title,

                    start:
                        startDate,

                    end:
                        (
                            isDeadlineSheet &&
                            endDate !== startDate
                        )
                            ? addOneDay(endDate)
                            : '',

                    rawEnd:
                        endDate,

                    description:
                        descStr,

                    backgroundColor:
                        finalColor,

                    borderColor:
                        finalColor,

                    status:
                        normalizeStatus(
                            statusStr
                        ),

                    allDay:
                        true
                };
            })
            .filter(Boolean);
    }

    async function fetchEventsFromSheets(
        info,
        successCallback
    ) {
        setSyncState('loading');

        try {
            const [
                resEvents,
                resDeadlines
            ] = await Promise.all([
                fetch(
                    URL_EVENTS,
                    { cache: 'no-store' }
                ),

                fetch(
                    URL_DEADLINES,
                    { cache: 'no-store' }
                )
            ]);

            if (
                !resEvents.ok ||
                !resDeadlines.ok
            ) {
                throw new Error(
                    `HTTP ${resEvents.status}/${resDeadlines.status}`
                );
            }

            const [
                textEvents,
                textDeadlines
            ] = await Promise.all([
                resEvents.text(),
                resDeadlines.text()
            ]);

            const calendarEvents =
                parseSheetData(
                    textEvents,
                    false
                );

            const longTermDeadlines =
                parseSheetData(
                    textDeadlines,
                    true
                );

            renderLongTermDeadlines(
                longTermDeadlines
            );

            successCallback(
                calendarEvents
            );

            setSyncState(
                'success'
            );

            showToast(
                `Đã tải ${calendarEvents.length} lịch + ${longTermDeadlines.length} mục tiêu`
            );
        }

        catch (error) {
            console.error(
                'Lỗi đồng bộ dữ liệu:',
                error
            );

            document
                .getElementById(
                    'deadline-list'
                )
                .innerHTML = `
                    <div class="deadline-empty">
                        <div>
                            <strong>Không tải được dữ liệu</strong>
                            <span>Kiểm tra quyền chia sẻ Google Sheets rồi tải lại trang.</span>
                        </div>
                    </div>
                `;

            updateDeadlineSummary([]);

            setSyncState(
                'error',
                'Không lấy được dữ liệu'
            );

            successCallback([]);
        }
    }

    function formatGoogleDate(dateStr) {
        if (
            !dateStr ||
            typeof dateStr !== 'string'
        ) {
            return dateStr;
        }

        if (
            dateStr.startsWith('Date')
        ) {
            const parts =
                dateStr.match(/\d+/g);

            if (
                !parts ||
                parts.length < 3
            ) {
                return '';
            }

            return (
                `${parts[0]}-` +
                `${(
                    parseInt(
                        parts[1],
                        10
                    ) + 1
                )
                    .toString()
                    .padStart(
                        2,
                        '0'
                    )}-` +
                `${parts[2].padStart(
                    2,
                    '0'
                )}`
            );
        }

        return dateStr;
    }

    function openModal({
        title,
        date,
        description,
        color,
        status
    }) {
        modalTitle.textContent =
            title ||
            'Không có tiêu đề';

        modalDate.textContent =
            date ||
            'Không có thời gian';

        modalDesc.textContent =
            description ||
            'Không có ghi chú chi tiết.';

        modalAccent.style.backgroundColor =
            color ||
            '#7c83ff';

        const type =
            statusType(status);

        statusBadge.textContent =
            normalizeStatus(status);

        statusBadge.className =
            'status-badge';

        if (type === 'done') {
            statusBadge.classList.add(
                'is-done'
            );
        }

        if (type === 'progress') {
            statusBadge.classList.add(
                'is-progress'
            );
        }

        if (type === 'debt') {
            statusBadge.classList.add(
                'is-debt'
            );
        }

        modal.classList.remove(
            'hidden',
            'is-closing'
        );

        modal.setAttribute(
            'aria-hidden',
            'false'
        );

        document.body.style.overflow =
            'hidden';

        requestAnimationFrame(
            () => {
                document
                    .getElementById(
                        'close-modal'
                    )
                    .focus({
                        preventScroll:
                            true
                    });
            }
        );
    }

    function closeModal() {
        if (
            modal.classList.contains(
                'hidden'
            ) ||
            modal.classList.contains(
                'is-closing'
            )
        ) {
            return;
        }

        modal.classList.add(
            'is-closing'
        );

        modal.setAttribute(
            'aria-hidden',
            'true'
        );

        setTimeout(() => {
            modal.classList.add(
                'hidden'
            );

            modal.classList.remove(
                'is-closing'
            );

            document.body.style.overflow =
                '';
        }, 185);
    }

    const calendar =
        new FullCalendar.Calendar(
            calendarEl,
            {
                initialView:
                    window.innerWidth < 768
                        ? 'listMonth'
                        : 'dayGridMonth',

                locale:
                    'vi',

                firstDay:
                    1,

                height:
                    'auto',

                fixedWeekCount:
                    false,

                dayMaxEvents:
                    4,

                moreLinkClick:
                    'popover',

                headerToolbar: {
                    left:
                        'prev,next today',

                    center:
                        'title',

                    right:
                        'dayGridMonth,listMonth'
                },

                buttonText: {
                    today:
                        'Hôm nay',

                    month:
                        'Tháng',

                    list:
                        'Danh sách'
                },

                events:
                    fetchEventsFromSheets,

                eventClassNames:
                    function (arg) {
                        const type =
                            statusType(
                                arg.event
                                    .extendedProps
                                    .status
                            );

                        const classes = [];

                        if (
                            type === 'done'
                        ) {
                            classes.push(
                                'event-completed'
                            );
                        }

                        if (
                            type === 'progress' ||
                            type === 'debt'
                        ) {
                            classes.push(
                                'event-in-progress'
                            );
                        }

                        return classes;
                    },

                eventClick:
                    function (info) {
                        info.jsEvent
                            .preventDefault();

                        const event =
                            info.event;

                        openModal({
                            title:
                                event.title,

                            date:
                                event.start
                                    .toLocaleDateString(
                                        'vi-VN',
                                        {
                                            weekday:
                                                'long',

                                            day:
                                                'numeric',

                                            month:
                                                'long',

                                            year:
                                                'numeric'
                                        }
                                    ),

                            description:
                                event
                                    .extendedProps
                                    .description ||
                                'Chưa có thông tin ghi chú.',

                            color:
                                event.backgroundColor,

                            status:
                                event
                                    .extendedProps
                                    .status
                        });
                    },

                eventDidMount:
                    function (info) {
                        info.el.setAttribute(
                            'title',
                            `${info.event.title} · ${normalizeStatus(
                                info.event
                                    .extendedProps
                                    .status
                            )}`
                        );
                    },

                windowResize:
                    function () {
                        const desiredView =
                            window.innerWidth < 768
                                ? 'listMonth'
                                : 'dayGridMonth';

                        if (
                            calendar.view
                                .type !==
                            desiredView
                        ) {
                            calendar.changeView(
                                desiredView
                            );
                        }
                    }
            }
        );

    calendar.render();

    document
        .getElementById('close-modal')
        .addEventListener(
            'click',
            closeModal
        );

    document
        .getElementById('modal-overlay')
        .addEventListener(
            'click',
            closeModal
        );

    document
        .getElementById('btn-confirm')
        .addEventListener(
            'click',
            closeModal
        );

    window.addEventListener(
        'keydown',
        event => {
            if (
                event.key ===
                'Escape'
            ) {
                closeModal();
            }
        }
    );
});