/**
 * Browser half of `dsh-session-rail`.
 *
 * The sidebar hides the Workspace/Session browsing region when it collapses to
 * the 56px rail. This package puts a "Chats" row into `sidebar.panellist` — the
 * global-panel icon list the shell renders directly under the New Session
 * button — and shapes the rail into: brand, New session, Search, Chats,
 * Settings. The row exists only while the rail is collapsed, so a wide sidebar
 * keeps the standard Workspaces browser untouched.
 *
 * The flyout itself:
 *
 * - it is a flat list, always expanded: the three most recently used workspaces,
 *   each with up to four of its most recent sessions, and no disclosure controls;
 * - the panel's height is frozen when it opens, so list updates never move its
 *   edge away from the pointer;
 * - it closes only when the pointer is clearly away (24px outside the row and
 *   the panel, for 420ms), and the close plays a short exit animation;
 * - no scrollbars are drawn (neither axis): the content is capped to fit, and any
 *   overflow on a short window scrolls with the wheel but without chrome;
 * - rows carry the same statuses the sidebar shows: waiting for an answer,
 *   running, completed, and the active-Schedule marker;
 * - the query runs the host's content search next to the local title match, with
 *   snippets, debounced and aborted like the sidebar's own search;
 * - a workspace row offers "new session in this workspace" on hover, and a chat
 *   row offers fork, rename and archive;
 * - the list is a `tree` of session rows: arrows move, Enter activates, and the
 *   search box hands focus to the list on ArrowDown.
 *
 * The glyph is drawn inline because `dsh-client-ui-primitives` has no plain
 * speech bubble, and the whole bundle is hand-written in the client-module
 * factory format so the package needs no build step and no dependencies beyond
 * the platform-seeded modules (react, react-dom, primitives).
 */
window.__ModuleLoader__.load({
	id: "dsh-session-rail",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const ReactDOM = require("react-dom");
		const P = require("@deepseek-ai/dsh-client-ui-primitives");

		/** Locale namespace this plugin owns. */
		const NS = "session-rail";
		/** Row id: the panellist row key and its matching `main` panel key. */
		const PANEL_ID = "session-rail";
		/** How many of the most recent workspaces the list shows. */
		const MAX_PROJECTS = 3;
		/** How many of each workspace's most recent chats it shows. */
		const MAX_CHATS = 4;
		/** Delay before a hover on the row opens the flyout. */
		const HOVER_OPEN_MS = 160;
		/** Grace period before a pointer that left the row and flyout closes it. */
		const HOVER_CLOSE_MS = 420;
		/** How far outside the row and flyout the pointer may stray and still count. */
		const CLOSE_MARGIN = 24;
		/** Exit animation duration; the flyout stays mounted for this long. */
		const FLYOUT_EXIT_MS = 120;
		/** Debounce before the host content search runs for a query. */
		const SEARCH_DEBOUNCE_MS = 250;
		/** Gap between the anchor row and the flyout. */
		const GAP = 8;
		/** Collapsed rail width, matching the sidebar shell geometry. */
		const RAIL_WIDTH = 56;

		/** Chinese dictionary (the key-set source of truth). */
		const zh = {
			label: "会话",
			search: "搜索会话",
			"empty.none": "暂无会话",
			"empty.noMatch": "没有匹配项",
			loading: "加载中",
			ungrouped: "未分组",
			close: "关闭",
			"project.new": "在此项目中新建会话",
			"action.fork": "创建分支",
			"action.rename": "重命名",
			"action.archive": "归档",
			"action.failed": "操作失败",
			"rename.title": "重命名会话",
			"rename.label": "标题",
			"rename.save": "保存",
			"rename.cancel": "取消",
			"rename.failed": "重命名失败",
			"search.failed": "内容搜索不可用",
			"status.running": "运行中",
			"status.waitingApproval": "等待批准",
			"status.planReview": "计划待审核",
			"status.waitingAnswer": "等待回答",
			"status.completed": "已完成",
			"status.schedule": "有活动的计划任务",
			"ago.now": "刚刚",
			"ago.minutes": "{count} 分钟",
			"ago.hours": "{count} 小时",
			"ago.days": "{count} 天",
			"ago.months": "{count} 个月",
			"ago.years": "{count} 年",
			"hint.keys": "↑↓ 导航 · Enter 打开 · Esc 关闭"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			label: "Chats",
			search: "Search chats",
			"empty.none": "No chats yet",
			"empty.noMatch": "Nothing matches",
			loading: "Loading",
			ungrouped: "No project",
			close: "Close",
			"project.new": "New session in this project",
			"action.fork": "Fork",
			"action.rename": "Rename",
			"action.archive": "Archive",
			"action.failed": "Action failed",
			"rename.title": "Rename session",
			"rename.label": "Title",
			"rename.save": "Save",
			"rename.cancel": "Cancel",
			"rename.failed": "Rename failed",
			"search.failed": "Content search unavailable",
			"status.running": "Running",
			"status.waitingApproval": "Waiting for approval",
			"status.planReview": "Plan awaiting review",
			"status.waitingAnswer": "Waiting for answer",
			"status.completed": "Completed",
			"status.schedule": "Has active scheduled task",
			"ago.now": "just now",
			"ago.minutes": "{count} min",
			"ago.hours": "{count} h",
			"ago.days": "{count} d",
			"ago.months": "{count} mo",
			"ago.years": "{count} y",
			"hint.keys": "↑↓ navigate · Enter open · Esc close"
		};
		/** Russian dictionary, registered as its own language pack. */
		const ru = {
			label: "Чаты",
			search: "Поиск чатов",
			"empty.none": "Пока нет чатов",
			"empty.noMatch": "Ничего не найдено",
			loading: "Загрузка",
			ungrouped: "Без проекта",
			close: "Закрыть",
			"project.new": "Новый чат в этом проекте",
			"action.fork": "Форк",
			"action.rename": "Переименовать",
			"action.archive": "Архивировать",
			"action.failed": "Не удалось выполнить",
			"rename.title": "Переименовать чат",
			"rename.label": "Название",
			"rename.save": "Сохранить",
			"rename.cancel": "Отмена",
			"rename.failed": "Не удалось переименовать",
			"search.failed": "Поиск по содержимому недоступен",
			"status.running": "Выполняется",
			"status.waitingApproval": "Ждёт подтверждения",
			"status.planReview": "План ждёт проверки",
			"status.waitingAnswer": "Ждёт ответа",
			"status.completed": "Завершено",
			"status.schedule": "Есть активная задача по расписанию",
			"ago.now": "только что",
			"ago.minutes": "{count} мин",
			"ago.hours": "{count} ч",
			"ago.days": "{count} д",
			"ago.months": "{count} мес",
			"ago.years": "{count} г",
			"hint.keys": "↑↓ — навигация · Enter — открыть · Esc — закрыть"
		};

		/** Speech-bubble rail glyph; see the module header for why it is inline. */
		function ChatBubbleGlyph(props) {
			const size = props.size === undefined ? 18 : props.size;
			return React.createElement("svg", {
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				xmlns: "http://www.w3.org/2000/svg",
				"aria-hidden": "true"
			}, React.createElement("path", {
				d: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
				stroke: "currentColor",
				strokeWidth: 1.7,
				strokeLinecap: "round",
				strokeLinejoin: "round"
			}));
		}

		const CSS_TAG = "dsh-session-rail.css";
		const CSS = [
			".dsh-rail-sessions__glyph{display:flex;align-items:center;justify-content:center;color:inherit}",
			"[data-sidebar-collapsed] .dsh-rail-sessions__hide-in-rail{display:none}",
			".dsh-rail-sessions__panel{position:fixed;z-index:80;display:flex;flex-direction:column;width:320px;overflow:hidden;scrollbar-width:none;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.28));border-radius:12px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-2,#1c1c1e));box-shadow:0 14px 36px rgba(0,0,0,.28);color:var(--dsw-alias-label-primary,inherit);font-size:13px;line-height:1.35;transform-origin:top left;animation:dsh-rail-flyout-in 150ms cubic-bezier(.2,.8,.2,1)}",
			".dsh-rail-sessions__panel.is-closing{animation:dsh-rail-flyout-out 120ms ease-in forwards;pointer-events:none}",
			"@keyframes dsh-rail-flyout-in{from{opacity:0;transform:translateY(-5px) scale(.98)}to{opacity:1;transform:none}}",
			"@keyframes dsh-rail-flyout-out{from{opacity:1;transform:none}to{opacity:0;transform:translateY(-5px) scale(.985)}}",
			"@keyframes dsh-rail-chats-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}",
			"@keyframes dsh-rail-pulse{0%,100%{opacity:.35}50%{opacity:.75}}",
			"@media (prefers-reduced-motion:reduce){.dsh-rail-sessions__panel,.dsh-rail-sessions__panel.is-closing,.dsh-rail-sessions__chats,.dsh-rail-sessions__skeleton{animation:none}}",
			".dsh-rail-sessions__search{display:flex;align-items:center;gap:6px;flex:none;margin:8px 8px 4px;padding:6px 8px;border-radius:8px;background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.1));color:var(--dsw-alias-label-tertiary,inherit)}",
			".dsh-rail-sessions__input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:inherit;font:inherit}",
			".dsh-rail-sessions__input::placeholder{color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.9))}",
			".dsh-rail-sessions__list{flex:1;min-height:180px;overflow-y:auto;overflow-x:hidden;padding:4px 6px 8px;outline:none;scrollbar-width:none}",
			".dsh-rail-sessions__list:focus-visible{box-shadow:inset 0 0 0 2px var(--dsw-alias-brand-primary,#4d6bfe);border-radius:8px}",
			".dsh-rail-sessions__list::-webkit-scrollbar{display:none}",
			".dsh-rail-sessions__group{display:block;margin-bottom:2px}",
			".dsh-rail-sessions__project{box-sizing:border-box;display:flex;align-items:center;gap:6px;width:100%;height:32px;padding:6px 8px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,inherit);font:inherit;text-align:left;cursor:pointer}",
			".dsh-rail-sessions__project:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14));color:var(--dsw-alias-label-primary,inherit)}",
			".dsh-rail-sessions__projectTitle{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}",
			".dsh-rail-sessions__count{flex:none;color:var(--dsw-alias-label-tertiary,inherit);font-variant-numeric:tabular-nums}",
			".dsh-rail-sessions__chats{animation:dsh-rail-chats-in 150ms cubic-bezier(.2,.8,.2,1)}",
			".dsh-rail-sessions__chat{box-sizing:border-box;display:flex;align-items:center;gap:6px;width:100%;height:28px;padding:5px 8px 5px 22px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,inherit);font:inherit;text-align:left;cursor:pointer}",
			".dsh-rail-sessions__chat:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14));color:var(--dsw-alias-label-primary,inherit)}",
			".dsh-rail-sessions__chat.is-current{background:var(--dsw-alias-interactive-bg-active,rgba(127,127,127,.2));color:var(--dsw-alias-label-primary,inherit)}",
			".dsh-rail-sessions__chat.is-active{box-shadow:inset 0 0 0 2px var(--dsw-alias-brand-primary,#4d6bfe)}",
			".dsh-rail-sessions__chatTitle{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dsh-rail-sessions__snippet{display:block;color:var(--dsw-alias-label-tertiary,inherit);font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dsh-rail-sessions__ago{flex:none;color:var(--dsw-alias-label-tertiary,inherit);font-size:11px;font-variant-numeric:tabular-nums}",
			".dsh-rail-sessions__status{flex:none;display:inline-flex;align-items:center}",
			".dsh-rail-sessions__alarm{flex:none;display:inline-flex;color:var(--dsw-alias-label-tertiary,inherit)}",
			".dsh-rail-sessions__rowActions{flex:none;display:none;align-items:center;gap:2px}",
			".dsh-rail-sessions__project:hover .dsh-rail-sessions__rowActions,.dsh-rail-sessions__chat:hover .dsh-rail-sessions__rowActions,.dsh-rail-sessions__rowActions:focus-within{display:inline-flex}",
			".dsh-rail-sessions__iconButton{display:inline-flex;align-items:center;justify-content:center;width:20px;height:18px;padding:0;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary,inherit);cursor:pointer}",
			".dsh-rail-sessions__iconButton:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.18));color:var(--dsw-alias-label-primary,inherit)}",
			".dsh-rail-sessions__resultProject{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary,inherit)}",
			".dsh-rail-sessions__action{display:block;width:auto;padding:4px 10px;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-brand-primary,inherit);font:inherit;text-align:left;cursor:pointer}",
			".dsh-rail-sessions__action:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}",
			".dsh-rail-sessions__empty{padding:14px 10px;color:var(--dsw-alias-label-tertiary,inherit);text-align:center}",
			".dsh-rail-sessions__notice{margin:0 8px 6px;padding:6px 8px;border-radius:8px;background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.1));color:var(--dsw-alias-label-secondary,inherit);font-size:11px}",
			".dsh-rail-sessions__skeleton{display:flex;align-items:center;gap:8px;padding:6px 8px;animation:dsh-rail-pulse 1.2s ease-in-out infinite}",
			".dsh-rail-sessions__skeletonBar{height:10px;border-radius:5px;background:var(--dsw-alias-bg-skeleton,var(--dsw-alias-bg-layer-1,rgba(127,127,127,.2)))}",
			".dsh-rail-sessions__hints{flex:none;padding:4px 10px 8px;color:var(--dsw-alias-label-tertiary,inherit);font-size:11px}",
			".dsh-rail-sessions__main{display:flex;flex-direction:column;height:100%;min-height:0;color:var(--dsw-alias-label-primary,inherit)}",
			".dsh-rail-sessions__mainHead{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;padding:14px 16px 6px}",
			".dsh-rail-sessions__mainTitle{font-size:15px;font-weight:600}",
			".dsh-rail-sessions__mainBody{flex:1;min-height:0;display:flex;flex-direction:column;padding:0 10px 10px}",
			".dsh-rail-sessions__renameField{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:8px;background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.08));color:var(--dsw-alias-label-primary,inherit);font:inherit}",
			".dsh-rail-sessions__renameError{margin-top:6px;color:var(--dsw-alias-label-danger,#e5484d);font-size:12px}"
		].join("");

		/** Install the plugin stylesheet once per page. */
		function injectCss() {
			if (typeof document === "undefined") return;
			if (document.querySelector('style[data-plugin-css="' + CSS_TAG + '"]') !== null) return;
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-session-rail";
			tag.dataset.pluginCss = CSS_TAG;
			tag.textContent = CSS;
			document.head.appendChild(tag);
		}

		/**
		 * Render the first glyph this build exports, so a renamed primitive
		 * degrades to no icon instead of crashing a row.
		 * @param names - candidate export names, best first.
		 * @param props - props for the chosen component.
		 * @returns the glyph element, or null when none of the names exist.
		 */
		function icon(names, props) {
			for (const name of names) {
				const Glyph = P[name];
				if (Glyph !== undefined && Glyph !== null) return React.createElement(Glyph, props);
			}
			return null;
		}

		/**
		 * Compact relative time for a row's update stamp.
		 * @param value - Session `updatedAt` in epoch milliseconds.
		 * @param t - translator for this namespace.
		 * @returns a short label, or an empty string without a usable stamp.
		 */
		function ago(value, t) {
			if (typeof value !== "number" || !Number.isFinite(value)) return "";
			const seconds = Math.max(0, Math.round((Date.now() - value) / 1000));
			if (seconds < 60) return t("ago.now");
			const minutes = Math.round(seconds / 60);
			if (minutes < 60) return t("ago.minutes", { count: minutes });
			const hours = Math.round(minutes / 60);
			if (hours < 24) return t("ago.hours", { count: hours });
			const days = Math.round(hours / 24);
			if (days < 30) return t("ago.days", { count: days });
			const months = Math.round(days / 30);
			if (months < 12) return t("ago.months", { count: months });
			return t("ago.years", { count: Math.round(months / 12) });
		}

		/**
		 * The statuses the sidebar shows for one session, in its precedence order.
		 * @param row - `SessionSummary`.
		 * @param pending - the pending interaction published for this session, if any.
		 * @param t - translator for this namespace.
		 * @returns the primary status, or null when the row carries none.
		 */
		function statusOf(row, pending, t) {
			const kind = pending === undefined || pending === null ? undefined : pending.kind;
			if (kind === "approval") return { state: "warning", label: t("status.waitingApproval") };
			if (kind === "plan-review") return { state: "warning", label: t("status.planReview") };
			if (kind === "question") return { state: "warning", label: t("status.waitingAnswer") };
			if (row.running === true) return { state: "ongoing", label: t("status.running") };
			if (row.completed === true) return { state: "done", label: t("status.completed") };
			return null;
		}

		/**
		 * Whether the list projection reports an undispatched Schedule record.
		 * @param row - `SessionSummary`.
		 * @returns true when the row should carry the alarm marker.
		 */
		function hasSchedule(row) {
			const values = row.projectionValues;
			if (values === undefined || values === null) return false;
			const schedule = values.schedule;
			return Array.isArray(schedule) && schedule.length > 0;
		}

		/**
		 * Project the two snapshots into browser groups, hiding rows the sidebar
		 * itself hides: subagent origins, archived sessions and the provisional
		 * blank New Session row.
		 * @param sessions - `SessionListState` snapshot.
		 * @param workspaces - `WorkspaceListState` snapshot.
		 * @returns projects ordered by their newest session, then one "no project" group.
		 */
		function groupSessions(sessions, workspaces) {
			const items = workspaces !== undefined && workspaces !== null && Array.isArray(workspaces.items) ? workspaces.items : [];
			const archived = new Set(workspaces !== undefined && workspaces !== null && Array.isArray(workspaces.archivedSessionIds) ? workspaces.archivedSessionIds : []);
			const byId = sessions !== undefined && sessions !== null && sessions.byId !== undefined ? sessions.byId : {};
			const ids = sessions !== undefined && sessions !== null && Array.isArray(sessions.ids) ? sessions.ids : [];
			const visible = (row) => row !== undefined && row !== null && row.origin !== "subagent" && !row.blank && !archived.has(row.id);
			const rows = [];
			for (const id of ids) {
				const row = byId[id];
				if (visible(row)) rows.push(row);
			}
			const byRecency = (a, b) => (b.updatedAt === undefined ? 0 : b.updatedAt) - (a.updatedAt === undefined ? 0 : a.updatedAt);
			const groups = [];
			const claimed = new Set();
			for (const workspace of items) {
				const members = [];
				for (const id of workspace.sessionIds === undefined ? [] : workspace.sessionIds) {
					claimed.add(id);
					const row = byId[id];
					if (visible(row)) members.push(row);
				}
				members.sort(byRecency);
				if (members.length > 0) groups.push({ id: workspace.workspaceId, title: workspace.title, items: members });
			}
			const orphans = rows.filter((row) => !claimed.has(row.id));
			orphans.sort(byRecency);
			if (orphans.length > 0) groups.push({ id: "__ungrouped", title: null, items: orphans });
			// "The most recent workspaces" means the ones whose newest visible session
			// is the newest; each group's members are already sorted by recency.
			const newest = (group) => (group.items.length === 0 || group.items[0].updatedAt === undefined ? 0 : group.items[0].updatedAt);
			groups.sort((a, b) => newest(b) - newest(a));
			return groups;
		}

		/** DOM id for one navigable row. */
		function rowDomId(key) {
			return "dsh-rail-row-" + key.replace(/[^a-zA-Z0-9_-]/g, "_");
		}

		/**
		 * The searchable project/chat browser shared by the flyout and the panel.
		 * @param props - variant, snapshots, injected actions and the translator.
		 * @returns the search row, the list and the keyboard hints.
		 */
		function RailBrowser(props) {
			const asPanel = props.variant === "panel";
			const t = props.t;
			const sessions = props.sessions;
			const pending = props.pending;
			const [query, setQuery] = React.useState("");
			/** Host content search: request-local, debounced and aborted. */
			const [content, setContent] = React.useState({ status: "idle", items: [], hasMore: false });
			/** Keyboard cursor: the key of the active row. */
			const [activeKey, setActiveKey] = React.useState(null);
			const [notice, setNotice] = React.useState(null);
			const [renameTarget, setRenameTarget] = React.useState(null);
			const [renameDraft, setRenameDraft] = React.useState("");
			const [renameError, setRenameError] = React.useState(null);
			const [renaming, setRenaming] = React.useState(false);
			const listRef = React.useRef(null);
			const nodesRef = React.useRef([]);
			const searchRef = React.useRef(null);

			const groups = React.useMemo(() => groupSessions(sessions, props.workspaces), [sessions, props.workspaces]);

			const trimmed = query.trim().toLowerCase();
			const searching = trimmed !== "";
			React.useEffect(() => {
				if (!searching) {
					setContent({ status: "idle", items: [], hasMore: false });
					return undefined;
				}
				const controller = new AbortController();
				const timer = window.setTimeout(() => {
					setContent((previous) => ({ status: "loading", items: previous.items, hasMore: false }));
					props
						.searchSessions(query.trim(), controller.signal)
						.then((value) => {
							if (controller.signal.aborted) return;
							setContent({ status: "ready", items: value.items, hasMore: value.hasMore === true });
						})
						.catch((reason) => {
							if (controller.signal.aborted) return;
							console.warn("dsh-session-rail: content search failed:", reason);
							setContent({ status: "error", items: [], hasMore: false });
						});
				}, SEARCH_DEBOUNCE_MS);
				return () => {
					controller.abort();
					window.clearTimeout(timer);
				};
			}, [query, searching]);

			/** Tell the flyout that a modal is up, so it keeps itself open for it. */
			React.useEffect(() => {
				if (props.onDialog === undefined) return undefined;
				props.onDialog(renameTarget !== null);
				return () => props.onDialog(false);
			}, [renameTarget]);

			React.useEffect(() => {
				if (notice === null) return undefined;
				const timer = window.setTimeout(() => setNotice(null), 4000);
				return () => window.clearTimeout(timer);
			}, [notice]);

			const run = (action, onDone) => {
				Promise.resolve()
					.then(action)
					.then(() => {
						if (onDone !== undefined) onDone();
					})
					.catch((reason) => setNotice((reason instanceof Error ? reason.message : String(reason)) || t("action.failed")));
			};

			/** Flat search results: local title matches first, then content hits. */
			const results = React.useMemo(() => {
				if (!searching) return [];
				const byId = sessions !== undefined && sessions !== null && sessions.byId !== undefined ? sessions.byId : {};
				const archived = new Set(props.workspaces !== undefined && props.workspaces !== null && Array.isArray(props.workspaces.archivedSessionIds) ? props.workspaces.archivedSessionIds : []);
				const visible = (row) => row !== undefined && row !== null && row.origin !== "subagent" && !row.blank && !archived.has(row.id);
				const snippetById = new Map();
				for (const item of content.items) {
					if (!snippetById.has(item.sessionId)) snippetById.set(item.sessionId, item.snippet);
				}
				const projectOf = new Map();
				for (const group of groups) {
					for (const row of group.items) if (!projectOf.has(row.id)) projectOf.set(row.id, group);
				}
				const rows = [];
				const seen = new Set();
				for (const group of groups) {
					for (const row of group.items) {
						const title = typeof row.displayTitle === "string" ? row.displayTitle.toLowerCase() : "";
						const project = typeof group.title === "string" ? group.title.toLowerCase() : "";
						if (!title.includes(trimmed) && !project.includes(trimmed)) continue;
						seen.add(row.id);
						rows.push({ row, group, snippet: snippetById.get(row.id) });
						snippetById.delete(row.id);
					}
				}
				for (const [sessionId, snippet] of snippetById) {
					const row = byId[sessionId];
					if (!visible(row) || seen.has(sessionId)) continue;
					rows.push({ row, group: projectOf.get(sessionId) ?? null, snippet });
				}
				const limit = typeof props.searchResultLimit === "number" && props.searchResultLimit > 0 ? props.searchResultLimit : 20;
				return rows.slice(0, limit);
			}, [searching, trimmed, groups, sessions, content, props.workspaces, props.searchResultLimit]);

			// -- row model ---------------------------------------------------------
			const nodes = [];
			let body;
			if (searching) {
				for (const result of results) {
					nodes.push({ key: "r:" + result.row.id, kind: "result", result });
				}
			} else {
				const visibleGroups = groups.slice(0, MAX_PROJECTS);
				body = [];
				for (const group of visibleGroups) {
					const title = group.title === null ? t("ungrouped") : group.title;
					const shown = group.items.slice(0, MAX_CHATS);
					const chatNodes = shown.map((row) => {
						const key = "s:" + row.id;
						nodes.push({ key, kind: "chat", row, group });
						const status = statusOf(row, pending === undefined ? undefined : pending.get(row.id), t);
						return React.createElement("div", {
							key: row.id,
							role: "treeitem",
							"aria-level": 1,
							id: rowDomId(key),
							tabIndex: -1,
							className: "dsh-rail-sessions__chat" + (sessions.current === row.id ? " is-current" : "") + (activeKey === key ? " is-active" : ""),
							title: row.displayTitle,
							onClick: () => {
								setActiveKey(key);
								props.onPicked(row.id);
							}
						},
							status === null ? icon(["IconClockOutline16", "IconClockOutline"], { size: 13, className: "dsh-rail-sessions__chatIcon" }) : React.createElement("span", { className: "dsh-rail-sessions__status", title: status.label }, React.createElement(P.StateDot, { state: status.state })),
							React.createElement("span", { className: "dsh-rail-sessions__chatTitle" }, row.displayTitle),
							hasSchedule(row) ? React.createElement("span", { className: "dsh-rail-sessions__alarm", title: t("status.schedule"), "aria-label": t("status.schedule") }, icon(["IconAlarmClockOutline16"], { size: 13 })) : null,
							React.createElement("span", { className: "dsh-rail-sessions__ago" }, ago(row.updatedAt, t)),
							React.createElement("span", { className: "dsh-rail-sessions__rowActions" },
								React.createElement("button", {
									type: "button",
									className: "dsh-rail-sessions__iconButton",
									title: t("action.fork"),
									"aria-label": t("action.fork"),
									onClick: (event) => {
										event.stopPropagation();
										run(() => props.forkSession(row.id));
									}
								}, icon(["IconBranchOutline16"], { size: 13 })),
								React.createElement("button", {
									type: "button",
									className: "dsh-rail-sessions__iconButton",
									title: t("action.rename"),
									"aria-label": t("action.rename"),
									onClick: (event) => {
										event.stopPropagation();
										setRenameError(null);
										setRenameDraft(row.displayTitle);
										setRenameTarget({ id: row.id, title: row.displayTitle });
									}
								}, icon(["IconEditOutline16"], { size: 13 })),
								React.createElement("button", {
									type: "button",
									className: "dsh-rail-sessions__iconButton",
									title: t("action.archive"),
									"aria-label": t("action.archive"),
									onClick: (event) => {
										event.stopPropagation();
										run(() => props.archiveSession(row.id));
									}
								}, icon(["IconArchiveOutline20"], { size: 14 }))
							)
						);
					});
					body.push(React.createElement("div", { key: group.id, className: "dsh-rail-sessions__group" },
						React.createElement("div", { key: "header", className: "dsh-rail-sessions__project" },
							icon(["IconFolderOpen16", "IconFolderOpen"], { size: 15 }),
							React.createElement("span", { className: "dsh-rail-sessions__projectTitle" }, title),
							React.createElement("span", { className: "dsh-rail-sessions__count" }, String(group.items.length)),
							React.createElement("span", { className: "dsh-rail-sessions__rowActions" },
								React.createElement("button", {
									type: "button",
									className: "dsh-rail-sessions__iconButton",
									title: t("project.new"),
									"aria-label": t("project.new"),
									onClick: (event) => {
										event.stopPropagation();
										run(() => props.startSession(group.id));
									}
								}, icon(["IconNewChatOutline16", "IconPlusOutline16"], { size: 14 }))
							)
						),
						React.createElement("div", { key: "chats", role: "group", "aria-label": title, className: "dsh-rail-sessions__chats" }, chatNodes)
					));
				}
			}
			nodesRef.current = nodes;

			const loading = !searching && (sessions === undefined || sessions === null || sessions.phase !== "ready");
			const empty = !loading && (searching ? results.length === 0 : nodes.length === 0);

			const activate = (node) => {
				if (node === undefined) return;
				if (node.kind === "chat") props.onPicked(node.row.id);
				else if (node.kind === "result") props.onPicked(node.result.row.id);
			};
			const move = (delta) => {
				const list = nodesRef.current;
				if (list.length === 0) return;
				const index = list.findIndex((node) => node.key === activeKey);
				const next = index < 0 ? (delta > 0 ? 0 : list.length - 1) : Math.min(list.length - 1, Math.max(0, index + delta));
				setActiveKey(list[next].key);
			};
			const onListKeyDown = (event) => {
				const node = nodesRef.current.find((candidate) => candidate.key === activeKey);
				if (event.key === "ArrowDown") {
					event.preventDefault();
					move(1);
				} else if (event.key === "ArrowUp") {
					event.preventDefault();
					if (nodesRef.current.findIndex((candidate) => candidate.key === activeKey) <= 0 && searchRef.current !== null) searchRef.current.focus();
					else move(-1);
				} else if (event.key === "Home") {
					event.preventDefault();
					if (nodesRef.current.length > 0) setActiveKey(nodesRef.current[0].key);
				} else if (event.key === "End") {
					event.preventDefault();
					if (nodesRef.current.length > 0) setActiveKey(nodesRef.current[nodesRef.current.length - 1].key);
				} else if (event.key === "Enter" || event.key === " ") {
					if (node === undefined) return;
					event.preventDefault();
					activate(node);
				}
			};
			React.useEffect(() => {
				if (activeKey === null) return;
				const node = listRef.current === null ? null : listRef.current.querySelector("#" + rowDomId(activeKey));
				if (node !== null && node.scrollIntoView !== undefined) node.scrollIntoView({ block: "nearest" });
			}, [activeKey]);

			/** Drop a stale cursor: archiving or a list refresh can remove its row. */
			React.useEffect(() => {
				if (activeKey === null) return;
				if (nodesRef.current.some((node) => node.key === activeKey)) return;
				setActiveKey(null);
			}, [activeKey, groups, results.length]);

			const confirmRename = () => {
				if (renameTarget === null || renaming) return;
				const title = renameDraft.trim();
				if (title === "") return;
				setRenaming(true);
				setRenameError(null);
				Promise.resolve()
					.then(() => props.renameSession(renameTarget.id, title))
					.then(() => {
						setRenaming(false);
						setRenameTarget(null);
					})
					.catch((reason) => {
						setRenaming(false);
						setRenameError(reason instanceof Error ? reason.message : String(reason));
					});
			};

			const searchRow = React.createElement("div", { className: "dsh-rail-sessions__search" },
				icon(["IconSearchOutline16", "IconSearchOutline"], { size: 14 }),
				React.createElement("input", {
					ref: searchRef,
					className: "dsh-rail-sessions__input",
					type: "text",
					placeholder: t("search"),
					value: query,
					autoFocus: !asPanel,
					onChange: (event) => setQuery(event.target.value),
					onKeyDown: (event) => {
						if (event.key === "ArrowDown") {
							event.preventDefault();
							const list = listRef.current;
							if (list !== null) list.focus();
							move(1);
						}
					}
				})
			);

			let content_;
			if (loading) {
				content_ = [0, 1, 2].map((index) => React.createElement("div", { key: index, className: "dsh-rail-sessions__skeleton" },
					React.createElement("span", { className: "dsh-rail-sessions__skeletonBar", style: { width: "14px" } }),
					React.createElement("span", { className: "dsh-rail-sessions__skeletonBar", style: { width: index === 0 ? "62%" : index === 1 ? "48%" : "55%" } })
				));
			} else if (empty) {
				content_ = React.createElement("div", { className: "dsh-rail-sessions__empty" }, searching ? t("empty.noMatch") : t("empty.none"));
			} else if (searching) {
				content_ = results.map((result) => {
					const key = "r:" + result.row.id;
					const status = statusOf(result.row, pending === undefined ? undefined : pending.get(result.row.id), t);
					return React.createElement("div", {
						key: result.row.id,
						role: "treeitem",
						"aria-level": 1,
						id: rowDomId(key),
						tabIndex: -1,
						className: "dsh-rail-sessions__chat" + (sessions.current === result.row.id ? " is-current" : "") + (activeKey === key ? " is-active" : ""),
						title: result.row.displayTitle,
						onClick: () => {
							setActiveKey(key);
							props.onPicked(result.row.id);
						}
					},
						status === null ? icon(["IconClockOutline16", "IconClockOutline"], { size: 13, className: "dsh-rail-sessions__chatIcon" }) : React.createElement("span", { className: "dsh-rail-sessions__status", title: status.label }, React.createElement(P.StateDot, { state: status.state })),
						React.createElement("span", { className: "dsh-rail-sessions__chatTitle" },
							React.createElement("span", { className: "dsh-rail-sessions__chatTitle" }, result.row.displayTitle),
							result.snippet === undefined ? null : React.createElement("span", { className: "dsh-rail-sessions__snippet" }, result.snippet)
						),
						result.group === null || result.group.title === null ? null : React.createElement("span", { className: "dsh-rail-sessions__resultProject" }, result.group.title)
					);
				});
			} else {
				content_ = body;
			}

			const list = React.createElement("div", {
				ref: listRef,
				className: "dsh-rail-sessions__list",
				role: "tree",
				"aria-label": t("label"),
				"aria-activedescendant": activeKey === null ? undefined : rowDomId(activeKey),
				tabIndex: 0,
				onKeyDown: onListKeyDown,
				onFocus: () => {
					if (activeKey === null && nodesRef.current.length > 0) setActiveKey(nodesRef.current[0].key);
				}
			}, content_);

			const footer = [
				content.status === "error" ? React.createElement("div", { key: "search-error", className: "dsh-rail-sessions__notice" }, t("search.failed")) : null,
				notice === null ? null : React.createElement("div", { key: "notice", className: "dsh-rail-sessions__notice" }, notice),
				React.createElement("div", { key: "hints", className: "dsh-rail-sessions__hints" }, t("hint.keys"))
			];

			const renameDialog = renameTarget === null ? null : React.createElement(P.Modal, {
				open: true,
				onClose: () => {
					if (!renaming) setRenameTarget(null);
				},
				closeLabel: t("close"),
				title: t("rename.title"),
				footer: React.createElement(React.Fragment, null,
					React.createElement(P.Button, {
						variant: "outline",
						onClick: () => setRenameTarget(null),
						disabled: renaming,
						children: t("rename.cancel")
					}),
					React.createElement(P.Button, {
						variant: "primary",
						onClick: confirmRename,
						disabled: renaming || renameDraft.trim() === "",
						children: t("rename.save")
					})
				)
			},
				React.createElement("label", { className: "dsh-rail-sessions__renameLabel" },
					React.createElement("span", { className: "dsh-rail-sessions__snippet" }, t("rename.label")),
					React.createElement("input", {
						className: "dsh-rail-sessions__renameField",
						type: "text",
						value: renameDraft,
						autoFocus: true,
						onChange: (event) => setRenameDraft(event.target.value),
						onKeyDown: (event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								confirmRename();
							}
						}
					})
				),
				renameError === null ? null : React.createElement("div", { className: "dsh-rail-sessions__renameError" }, t("rename.failed") + ": " + renameError)
			);

			if (asPanel) {
				return React.createElement(React.Fragment, null,
					React.createElement("div", { className: "dsh-rail-sessions__main" },
						React.createElement("div", { className: "dsh-rail-sessions__mainHead" },
							React.createElement("span", { className: "dsh-rail-sessions__mainTitle" }, t("label")),
							React.createElement("button", {
								type: "button",
								className: "dsh-rail-sessions__action",
								onClick: () => props.closePanel()
							}, t("close"))
						),
						React.createElement("div", { className: "dsh-rail-sessions__mainBody" }, searchRow, list, footer)
					),
					renameDialog
				);
			}
			return React.createElement(React.Fragment, null, searchRow, list, footer, renameDialog);
		}

		/**
		 * The glyph the sidebar shell renders inside its panellist row, plus the
		 * flyout that row opens.
		 * @param props - shell glyph props and the injected face.
		 * @returns the glyph and, while open, the portalled flyout.
		 */
		function RailGlyph(props) {
			const sessions = props.useRailSessions((state) => state);
			const workspaceState = props.useRailWorkspaces((state) => state);
			const pending = props.useSessionPendingInteraction((state) => state);
			const [open, setOpen] = React.useState(false);
			const [closing, setClosing] = React.useState(false);
			const [anchor, setAnchor] = React.useState(null);
			const [lockedHeight, setLockedHeight] = React.useState(null);
			const glyphRef = React.useRef(null);
			const panelRef = React.useRef(null);
			const rowRef = React.useRef(null);
			const openRef = React.useRef(false);
			const outsideRef = React.useRef(false);
			/** True while this browser has a modal dialog open over the flyout. */
			const dialogRef = React.useRef(false);
			/** True from the moment a close is decided until its animation ends. */
			const closingRef = React.useRef(false);
			const openTimer = React.useRef(null);
			const closeTimer = React.useRef(null);
			const unmountTimer = React.useRef(null);

			const clearTimers = () => {
				if (openTimer.current !== null) {
					window.clearTimeout(openTimer.current);
					openTimer.current = null;
				}
				if (closeTimer.current !== null) {
					window.clearTimeout(closeTimer.current);
					closeTimer.current = null;
				}
			};
			/**
			 * Abandon a pending close because the pointer came back. Once the decision
			 * to close is made (`hide` ran) it is final: letting a stray pointer event
			 * resurrect the flyout is what leaves it stuck open. Re-opening goes through
			 * the row, which calls `show`.
			 */
			const cancelClose = () => {
				if (closingRef.current) return;
				clearTimers();
				if (unmountTimer.current !== null) {
					window.clearTimeout(unmountTimer.current);
					unmountTimer.current = null;
				}
				outsideRef.current = false;
				setClosing(false);
			};
			const show = () => {
				closingRef.current = false;
				cancelClose();
				const row = rowRef.current;
				if (row !== null && row !== undefined) setAnchor(row.getBoundingClientRect());
				openRef.current = true;
				setOpen(true);
			};
			const hide = () => {
				clearTimers();
				if (!openRef.current) return;
				openRef.current = false;
				closingRef.current = true;
				setClosing(true);
				if (unmountTimer.current !== null) window.clearTimeout(unmountTimer.current);
				unmountTimer.current = window.setTimeout(() => {
					unmountTimer.current = null;
					closingRef.current = false;
					setOpen(false);
					setClosing(false);
				}, FLYOUT_EXIT_MS);
			};
			const scheduleOpen = () => {
				clearTimers();
				openTimer.current = window.setTimeout(show, HOVER_OPEN_MS);
			};
			const scheduleClose = () => {
				if (openTimer.current !== null) {
					window.clearTimeout(openTimer.current);
					openTimer.current = null;
				}
				closeTimer.current = window.setTimeout(hide, HOVER_CLOSE_MS);
			};
			/**
			 * Decide from one pointer reading whether the control is still in play.
			 * Proximity rather than the panel's own `mouseleave` is what keeps the
			 * flyout alive while the layout shifts between two projects.
			 * @param x - pointer client X.
			 * @param y - pointer client Y.
			 */
			const evaluatePointer = (x, y) => {
				// While a dialog of ours is up the pointer is over a portal the flyout
				// does not contain, so proximity must not count that as leaving.
				if (dialogRef.current) {
					cancelClose();
					return;
				}
				const near = (node) => {
					if (node === null || node === undefined) return false;
					const rect = node.getBoundingClientRect();
					return x >= rect.left - CLOSE_MARGIN && x <= rect.right + CLOSE_MARGIN && y >= rect.top - CLOSE_MARGIN && y <= rect.bottom + CLOSE_MARGIN;
				};
				if (near(rowRef.current) || near(panelRef.current)) {
					cancelClose();
					return;
				}
				if (outsideRef.current) return;
				outsideRef.current = true;
				scheduleClose();
			};

			/** Freeze the panel's height at open time so switching never resizes it. */
			React.useLayoutEffect(() => {
				if (!open) {
					setLockedHeight(null);
					return;
				}
				if (lockedHeight !== null) return;
				const node = panelRef.current;
				if (node === null || node === undefined) return;
				setLockedHeight(node.offsetHeight);
			}, [open, lockedHeight]);

			React.useEffect(() => {
				if (!open) return undefined;
				const onPointerDown = (event) => {
					const target = event.target;
					if (rowRef.current !== null && rowRef.current.contains(target)) return;
					if (panelRef.current !== null && panelRef.current.contains(target)) return;
					// The rename dialog portals outside both, so a click on it must not
					// read as "the pointer left the flyout". Only the dialog this browser
					// opened counts: matching every `role="presentation"` subtree would
					// swallow real outside clicks in deployments that mark page regions
					// that way.
					if (dialogRef.current) return;
					hide();
				};
				const onKeyDown = (event) => {
					if (event.key === "Escape") hide();
				};
				const onPointerMove = (event) => evaluatePointer(event.clientX, event.clientY);
				// `mousemove` and `pointermove` are both listened for: a host surface that
				// swallows one still leaves the other, and losing this signal is exactly
				// what makes the flyout feel stuck open.
				const onMove = (event) => onPointerMove(event);
				const onDocumentLeave = () => {
					if (dialogRef.current) return;
					scheduleClose();
				};
				const onWindowBlur = () => {
					if (dialogRef.current) return;
					hide();
				};
				/**
				 * Read the browser's own hover state instead of waiting for events. If a
				 * host surface swallows pointer events, this is the only thing that still
				 * notices the pointer left, so the flyout cannot stay stuck open.
				 */
				const watchdog = window.setInterval(() => {
					if (dialogRef.current) return;
					const hovered = Array.from(document.querySelectorAll(":hover"));
					const inside = hovered.some((node) => {
						if (panelRef.current !== null && panelRef.current.contains(node)) return true;
						return rowRef.current !== null && rowRef.current.contains(node);
					});
					if (inside) {
						cancelClose();
						return;
					}
					if (!openRef.current || outsideRef.current) return;
					outsideRef.current = true;
					scheduleClose();
				}, 250);
				document.addEventListener("pointerdown", onPointerDown, true);
				document.addEventListener("keydown", onKeyDown, true);
				document.addEventListener("mousemove", onMove, true);
				document.addEventListener("pointermove", onMove, true);
				// Deliberately non-capture and mouse-only: `pointerleave` in the capture
				// phase fires for every element the pointer leaves, which would close the
				// flyout while the operator is still using it.
				document.addEventListener("mouseleave", onDocumentLeave);
				window.addEventListener("blur", onWindowBlur);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown, true);
					document.removeEventListener("keydown", onKeyDown, true);
					document.removeEventListener("mousemove", onMove, true);
					document.removeEventListener("pointermove", onMove, true);
					document.removeEventListener("mouseleave", onDocumentLeave);
					window.removeEventListener("blur", onWindowBlur);
					window.clearInterval(watchdog);
				};
			}, [open]);

			React.useEffect(() => () => {
				clearTimers();
				if (unmountTimer.current !== null) window.clearTimeout(unmountTimer.current);
			}, []);

			/**
			 * Own the whole panellist row, not just the glyph inside it, and shape
			 * the rail. The shell renders one `<button>` per row and calls
			 * `selectPanel` on its click, so the row's own listener runs first and
			 * stops the event; the same pass moves the row after the Workspaces
			 * search icon and drops the Add-workspace header row.
			 */
			React.useEffect(() => {
				const glyph = glyphRef.current;
				if (glyph === null || glyph === undefined) return undefined;
				const row = glyph.closest("button");
				if (row === null) return undefined;
				rowRef.current = row;
				row.setAttribute("aria-haspopup", "dialog");
				const onClick = (event) => {
					event.preventDefault();
					event.stopPropagation();
					if (openRef.current) hide();
					else show();
				};
				const onEnter = () => {
					if (openRef.current) cancelClose();
					else scheduleOpen();
				};
				const onLeave = (event) => {
					clearTimers();
					evaluatePointer(event.clientX, event.clientY);
				};
				row.addEventListener("click", onClick);
				row.addEventListener("mouseenter", onEnter);
				row.addEventListener("mouseleave", onLeave);

				const nav = row.closest("nav");
				const region = nav === null ? null : nav.nextElementSibling;
				const foot = region === null ? null : region.nextElementSibling;
				const root = nav === null ? null : nav.parentElement;
				const styled = [];
				if (root !== null && getComputedStyle(root).display.includes("flex")) {
					styled.push([nav, "order", "3"], [region, "order", "2"], [region, "flex", "0 0 auto"], [foot, "order", "4"], [foot, "marginTop", "auto"]);
				}
				for (const [node, property, value] of styled) {
					if (node !== null && node !== undefined) node.style[property] = value;
				}
				const applyRailOrder = () => {
					const slot = region === null ? null : region.querySelector('[data-slot="sidebar.workspaces"]');
					if (slot === null) return false;
					const buttons = [...slot.querySelectorAll("button")];
					const last = buttons[buttons.length - 1];
					if (buttons.length < 2 || last === undefined) return true;
					let group = buttons[0].parentElement;
					let candidate = group === null ? null : group.parentElement;
					while (candidate !== null && candidate !== region && !candidate.contains(last) && candidate.querySelectorAll("button").length === 1) {
						group = candidate;
						candidate = candidate.parentElement;
					}
					if (group === null || group.contains(last)) return true;
					group.classList.add("dsh-rail-sessions__hide-in-rail");
					return true;
				};
				applyRailOrder();
				const watcher = region === null ? null : new MutationObserver(() => applyRailOrder());
				if (watcher !== null && region !== null) watcher.observe(region, { childList: true, subtree: true });
				return () => {
					row.removeEventListener("click", onClick);
					row.removeEventListener("mouseenter", onEnter);
					row.removeEventListener("mouseleave", onLeave);
					row.removeAttribute("aria-haspopup");
					row.removeAttribute("aria-expanded");
					if (watcher !== null) watcher.disconnect();
					for (const [node, property] of styled) {
						if (node !== null && node !== undefined) node.style[property] = "";
					}
					if (region !== null) {
						for (const group of region.querySelectorAll(".dsh-rail-sessions__hide-in-rail")) group.classList.remove("dsh-rail-sessions__hide-in-rail");
					}
					rowRef.current = null;
				};
			}, []);

			/** Mirror the flyout state onto the shell's row for assistive tech. */
			React.useEffect(() => {
				const row = rowRef.current;
				if (row !== null && row !== undefined) row.setAttribute("aria-expanded", open ? "true" : "false");
			}, [open]);

			/**
			 * Keep every pointer event on the flyout off the shell's row button.
			 * @param event - the element's own event.
			 */
			const consume = (event) => {
				event.stopPropagation();
			};

			const glyph = React.createElement("span", {
				ref: glyphRef,
				className: "dsh-rail-sessions__glyph",
				"aria-hidden": "true"
			}, React.createElement(ChatBubbleGlyph, { size: props.size === undefined ? 18 : props.size }));

			const flyout = open && anchor !== null
				? ReactDOM.createPortal(React.createElement("div", {
					ref: panelRef,
					className: "dsh-rail-sessions__panel" + (closing ? " is-closing" : ""),
					role: "dialog",
					"aria-label": props.t("label"),
					style: {
						left: anchor.right + GAP + "px",
						top: anchor.bottom + 4 + "px",
						maxHeight: Math.max(220, Math.min(520, window.innerHeight - anchor.bottom - GAP * 2)) + "px",
						height: lockedHeight === null ? undefined : lockedHeight + "px"
					},
					onPointerDown: consume,
					onClick: consume,
					onMouseEnter: cancelClose,
					onMouseLeave: (event) => {
						if (dialogRef.current) return;
						if (event.relatedTarget !== null && panelRef.current !== null && panelRef.current.contains(event.relatedTarget)) return;
						scheduleClose();
					}
				}, React.createElement(RailBrowser, {
					variant: "flyout",
					t: props.t,
					sessions,
					workspaces: workspaceState,
					pending,
					onPicked: (sessionId) => {
						props.openSession(sessionId);
						hide();
					},
					onDialog: (dialogOpen) => {
						dialogRef.current = dialogOpen;
					},
					forkSession: props.forkSession,
					renameSession: props.renameSession,
					archiveSession: props.archiveSession,
					startSession: props.startSession,
					searchSessions: props.searchSessions,
					searchResultLimit: props.searchResultLimit
				})), document.body)
				: null;

			return React.createElement(React.Fragment, null, glyph, flyout);
		}

		/**
		 * The `main` panel the row selects if something ever calls `selectPanel`:
		 * the same browser, full width, with a way back to the conversation.
		 * @param props - injected face plus the panel closer.
		 * @returns the panel element tree.
		 */
		function RailPanel(props) {
			const sessions = props.useRailSessions((state) => state);
			const workspaceState = props.useRailWorkspaces((state) => state);
			const pending = props.useSessionPendingInteraction((state) => state);
			return React.createElement(RailBrowser, {
				variant: "panel",
				t: props.t,
				sessions,
				workspaces: workspaceState,
				pending,
				onPicked: (sessionId) => props.openSession(sessionId),
				forkSession: props.forkSession,
				renameSession: props.renameSession,
				archiveSession: props.archiveSession,
				startSession: props.startSession,
				searchSessions: props.searchSessions,
				searchResultLimit: props.searchResultLimit,
				closePanel: props.closePanel
			});
		}

		/** Services the browser half needs before it can register its seats. */
		const inject = ["slots", "layout", "locale", "uiWorkspace", "sessions", "workspaces"];

		/**
		 * Register the rail row and its matching main panel.
		 * @param ctx - client root Context.
		 */
		function apply(ctx) {
			injectCss();
			const sessions = ctx.get("sessions");
			const workspaces = ctx.get("workspaces");
			const uiWorkspace = ctx.get("uiWorkspace");
			const layout = ctx.get("layout");
			const locale = ctx.get("locale");
			const t = locale.bind(NS);
			ctx.effect(() => locale.register(NS, { zh, en }), "session-rail: dictionaries");
			ctx.effect(() => {
				try {
					return locale.addLanguage({ id: "ru", label: "Русский", fallback: "en" });
				} catch (reason) {
					// The locale catalog is process-wide and a language id has one owner,
					// so another plugin may already have registered Russian. That must not
					// take this plugin down: the dictionary below is namespace-scoped and
					// still applies, it just rides the other pack's definition.
					console.warn("dsh-session-rail: ru language pack already registered, reusing it:", reason);
					return () => {};
				}
			}, "session-rail: ru language");
			ctx.effect(() => locale.register(NS, "ru", ru), "session-rail: ru dictionary");
			const face = (extra) => Object.assign({
				hooks: {
					railSessions: sessions.list,
					railWorkspaces: workspaces.list
				},
				openSession: (sessionId) => uiWorkspace.openSession(sessionId),
				forkSession: (sessionId) => uiWorkspace.forkSession(sessionId),
				archiveSession: (sessionId) => uiWorkspace.archiveSession(sessionId),
				startSession: (workspaceId) => uiWorkspace.startSession(workspaceId),
				renameSession: async (sessionId, title) => {
					const binding = sessions.binding(sessionId);
					if (binding === undefined) throw new Error('unknown session "' + sessionId + '"');
					const result = await binding.session.rename(title);
					if (!result.ok) throw new Error(result.error.message);
				},
				searchSessions: async (query, signal) => {
					const result = await sessions.search(query, signal);
					if (!result.ok) throw new Error(result.error.message);
					return result.value;
				},
				searchResultLimit: sessions.searchResultLimit
			}, extra);
			ctx.slots.inject("main", () => ctx.slots.register({
				name: "main",
				key: PANEL_ID,
				inject: () => face({ closePanel: () => layout.selectPanel(null) })
			}, RailPanel));
			let disposeRow = null;
			const syncRow = () => {
				const collapsed = document.querySelector("[data-sidebar-collapsed]") !== null;
				if (collapsed === (disposeRow !== null)) return;
				if (collapsed) {
					disposeRow = ctx.effect(() => ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
						name: "sidebar.panellist",
						id: PANEL_ID,
						label: () => t("label"),
						locale: NS,
						inject: () => face({})
					}, RailGlyph)), "session-rail: rail row");
					return;
				}
				disposeRow();
				disposeRow = null;
			};
			const observer = new MutationObserver(syncRow);
			observer.observe(document.documentElement, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ["data-sidebar-collapsed"]
			});
			ctx.effect(() => () => observer.disconnect(), "session-rail: fold watcher");
			syncRow();
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
