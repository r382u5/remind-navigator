import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, deleteField } from "firebase/firestore";
import { Bell, CheckCircle, Clock, Send, Plus, Calendar, User, LayoutDashboard, Circle, Users, Trash2, Repeat, ExternalLink, Link as LinkIcon, Mail, ChevronDown, ChevronUp, Pencil, Save, ArrowUpDown, BellRing, BarChart3, TrendingUp, Eye, LogOut, Download } from 'lucide-react';

// ▼▼▼ Firebase 接続の「合鍵」 ▼▼▼
const firebaseConfig = {
  apiKey: "AIzaSyCpCnpfMniJ3youqJLWbqoItgnIwuuiVL8",
  authDomain: "remind-navigator.firebaseapp.com",
  projectId: "remind-navigator",
  storageBucket: "remind-navigator.firebasestorage.app",
  messagingSenderId: "983919755014",
  appId: "1:983919755014:web:f33f8f35c5659048382887"
};

// Firebaseの初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
// ▲▲▲ ▲▲▲

const INITIAL_MEMBERS = [
  { id: 'm1', name: '管理者 (初期)', department: '管理者', role: 'admin', email: '' }, // ※初回の管理者をセットできるように空にしておく
  { id: 'm2', name: '石橋 英明', department: 'メンバー', role: 'member', email: 'ishibashi@example.com' },
  { id: 'm3', name: '増田 英明', department: 'メンバー', role: 'member', email: 'masuda@example.com' },
  { id: 'm4', name: '川崎 健史', department: '閲覧者', role: 'viewer', email: 'kawasaki@example.com' }
];

// スマホ・タブレット判定関数
const isMobileDevice = () => {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

export default function App() {
  const ENABLE_CROSS_HIGHLIGHT = false;

  // Firebase Auth States
  const [authUser, setAuthUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [loginError, setLoginError] = useState('');
  const [accessDeniedError, setAccessDeniedError] = useState('');

  // Firestore Data States
  const [members, setMembers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [taskTemplates, setTaskTemplates] = useState([]);

  // User Context States
  const [currentUser, setCurrentUser] = useState(null);
  const [viewMode, setViewMode] = useState('admin');
  const [isViewModeInitialized, setIsViewModeInitialized] = useState(false);
  
  // Target Members (閲覧者を除外)
  const targetMembers = members.filter(m => m.role !== 'viewer');

  // UI States
  const [showTaskTemplateModal, setShowTaskTemplateModal] = useState(false);
  const [newTaskTemplateName, setNewTaskTemplateName] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  
  // New Task States
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [showEmailConfirmModal, setShowEmailConfirmModal] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskIsRecurring, setNewTaskIsRecurring] = useState(false);
  const [newTaskUrl, setNewTaskUrl] = useState('');
  const [newTaskAutoRemind, setNewTaskAutoRemind] = useState(false);
  const [newTaskAutoRemindDays, setNewTaskAutoRemindDays] = useState(3);
  const [newTaskAutoRemindTime, setNewTaskAutoRemindTime] = useState('morning');

  // Remind States
  const [showRemindModal, setShowRemindModal] = useState(false);
  const [remindTask, setRemindTask] = useState(null);
  
  // Email Content States
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');

  // Member Management States
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [memberFormName, setMemberFormName] = useState('');
  const [memberFormRole, setMemberFormRole] = useState('member');
  const [memberFormEmail, setMemberFormEmail] = useState('');

  // Editing Task States
  const [taskInputMode, setTaskInputMode] = useState('select');
  const [showEditTaskModal, setShowEditTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskDueDate, setEditTaskDueDate] = useState('');
  const [editTaskIsRecurring, setEditTaskIsRecurring] = useState(false);
  const [editTaskUrl, setEditTaskUrl] = useState('');
  const [editTaskAutoRemind, setEditTaskAutoRemind] = useState(false);
  const [editTaskAutoRemindDays, setEditTaskAutoRemindDays] = useState(3);
  const [editTaskAutoRemindTime, setEditTaskAutoRemindTime] = useState('morning');

  // Calendar States
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [showCalendarTaskModal, setShowCalendarTaskModal] = useState(false);
  const [selectedCalendarTask, setSelectedCalendarTask] = useState(null);

  // Layout & Sorting
  const [adminSortOrder, setAdminSortOrder] = useState('dueDate');
  const [memberSortOrder, setMemberSortOrder] = useState('dueDate');
  const [fontSize, setFontSize] = useState('medium');
  const [hoveredTaskId, setHoveredTaskId] = useState(null);
  const [hoveredMemberId, setHoveredMemberId] = useState(null);
  const [expandedMemberId, setExpandedMemberId] = useState(null);

  const [mailTemplates, setMailTemplates] = useState({
    newTask: {
      subject: '【新規タスク】{タスク名} が追加されました',
      body: 'メンバー各位\n\nお疲れ様です。\n新しいタスクが追加されました。期日までのご対応をお願いいたします。\n\n■ タスク: {タスク名}\n■ 期限: {期日}\n{関連URL}\n\n👇 対応が終わりましたら、以下のURLから管理画面を開き「完了」ボタンを押してください。\n{アプリURL}'
    },
    remind: {
      subject: '【リマインド】{タスク名} のご対応をお願いします',
      body: 'お疲れ様です。\n以下のタスクが未完了となっております。\n期日が迫っておりますので、ご対応をお願いいたします。\n\n■ タスク: {タスク名}\n■ 期限: {期日}\n{関連URL}\n\n👇 対応が終わりましたら、以下のURLから「完了」ボタンを押してください。\n{アプリURL}'
    }
  });

  const [dialogConfig, setDialogConfig] = useState({ 
    isOpen: false, 
    type: 'alert',
    title: '', 
    message: '', 
    onConfirm: null 
  });

  // Authentication Listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setIsAuthLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  // Firestore Listeners (ログインしている時だけデータを取得)
  useEffect(() => {
    if (!authUser) return;

    // 1. Members Listener
    const unsubscribeMembers = onSnapshot(collection(db, 'members'), (snapshot) => {
      const membersData = snapshot.docs.map(doc => doc.data());
      
      // データベースが空っぽの場合（初回起動時）、初期データとログインした本人の情報を投入する
      if (membersData.length === 0) {
        const initialWithUser = [...INITIAL_MEMBERS];
        // 最初の管理者（m1）を、今ログインした人の名前に書き換える
        initialWithUser[0].name = authUser.displayName || '管理者';
        initialWithUser[0].email = authUser.email;
        
        initialWithUser.forEach(m => setDoc(doc(db, 'members', m.id), m));
      } else {
        setMembers(membersData);
      }
    });

    // 2. Tasks Listener
    const unsubscribeTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const tasksData = snapshot.docs.map(doc => doc.data());
      setTasks(tasksData);
    });

    // 3. Settings Listener (定型タスク名など)
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists()) {
        setTaskTemplates(docSnap.data().taskTemplates || []);
      } else {
        // 初期設定の定型タスクを投入
        setDoc(doc(db, 'settings', 'general'), { taskTemplates: ['Wevoxアンケート回答', '帰社日予定表入力', '下期目標シート提出', '交通費精算'] });
      }
    });

    return () => {
      unsubscribeMembers();
      unsubscribeTasks();
      unsubscribeSettings();
    };
  }, [authUser]);

  // 現在のユーザー情報をマッピングし、初期画面を決定する
  useEffect(() => {
    if (authUser && members.length > 0) {
      const foundMember = members.find(m => m.email === authUser.email);
      
      if (foundMember) {
        setCurrentUser(foundMember);
        setAccessDeniedError('');
        
        // 初回ロード時だけ、権限に応じた画面を開く
        if (!isViewModeInitialized) {
          if (foundMember.role === 'admin' || foundMember.role === 'viewer') {
            setViewMode('admin');
          } else {
            setViewMode('member');
          }
          setIsViewModeInitialized(true);
        }
      } else {
        // DBにメールアドレスがない人は弾く（強制ログアウトしてエラー表示）
        signOut(auth).then(() => {
          setAuthUser(null);
          setCurrentUser(null);
          setIsViewModeInitialized(false);
          setAccessDeniedError(`【アクセス拒否】\n${authUser.email} はこのアプリに登録されていません。\n管理者に招待を依頼してください。`);
        });
      }
    }
  }, [authUser, members, isViewModeInitialized]);

  useEffect(() => {
    if (fontSize === 'small') document.documentElement.style.fontSize = '14px';
    else if (fontSize === 'medium') document.documentElement.style.fontSize = '16px';
    else if (fontSize === 'large') document.documentElement.style.fontSize = '18px';
  }, [fontSize]);

  const handleGoogleLogin = () => {
    setLoginError('');
    setAccessDeniedError('');
    signInWithPopup(auth, provider).catch(error => {
      console.error("Login failed:", error);
      
      // auth/unauthorized-domain エラーの場合は、詳細メッセージからドメインを抽出する
      if (error.code === 'auth/unauthorized-domain') {
        const errorMsg = error.message || '';
        // "This domain (example.com) is not authorized" のようなメッセージからドメインを抽出する試み
        // または、コンソールに表示されるフルエラーメッセージをユーザーに見せる
        setLoginError(`【ドメイン未承認エラー】\nFirebaseでこのURLからのログインが許可されていません。\n以下のドメインをコピーして、Firebaseの「Authentication」>「設定」>「承認済みドメイン」に追加してください。\n\n追加するドメインの候補:\n・ ${window.location.hostname}\n・ ${window.location.hostname.replace('sandbox', 'googleusercontent')}\n\n※上記を追加してもダメな場合、ブラウザの「新しいタブで開く」アイコンから別画面で開き、そのURLのドメイン（最初の/まで）を追加してください。`);
      } else {
        setLoginError(`ログインに失敗しました。(${error.code})\nもう一度お試しください。`);
      }
    });
  };

  const handleLogout = () => {
    signOut(auth).then(() => {
      setIsViewModeInitialized(false);
      setCurrentUser(null);
    });
  };

  const isTaskOverdue = (dueDateStr) => {
    if (!dueDateStr) return false;
    const dueDate = new Date(dueDateStr.replace(/-/g, '/'));
    dueDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate < today;
  };

  const getCalendarDays = () => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ day: i, dateStr: dateStr });
    }
    return days;
  };

  const handlePrevMonth = () => {
    const newDate = new Date(currentCalendarDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentCalendarDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentCalendarDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentCalendarDate(newDate);
  };

  const exportToCSV = () => {
    // 1. ヘッダー行の作成
    const headers = ['タスク名', '期日', '全体進捗'];
    targetMembers.forEach(m => headers.push(m.name));
    
    // 2. データ行の作成
    const sortedTasks = getAdminSortedTasks(tasks);
    const rows = sortedTasks.map(task => {
      const completedCount = targetMembers.filter(m => task.statuses[m.id] === 'completed').length;
      const progressStr = `${completedCount}/${targetMembers.length}名`;
      
      // ダブルクォーテーションで囲む（タスク名にカンマが含まれていても崩れないようにするため）
      const row = [
        `"${task.title}"`,
        `"${task.dueDate}"`,
        `"${progressStr}"`
      ];
      
      targetMembers.forEach(m => {
        row.push(task.statuses[m.id] === 'completed' ? '完了' : '未完了');
      });
      return row.join(',');
    });
    
    // 3. CSV文字列の結合（\uFEFF はExcelでの文字化けを防ぐためのBOMです）
    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    
    // 4. ダウンロード処理
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const today = new Date();
    const dateStr = `${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
    link.setAttribute('download', `タスク進捗データ_${dateStr}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setIsProfileMenuOpen(false);
    showToast('CSVデータをダウンロードしました');
  };

  const showConfirm = (title, message, onConfirmCallback) => {
    setDialogConfig({ isOpen: true, type: 'confirm', title, message, onConfirm: onConfirmCallback });
  };

  const closeDialog = () => {
    setDialogConfig({ ...dialogConfig, isOpen: false });
  };

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const showAlert = (title, message) => {
    setDialogConfig({ isOpen: true, type: 'alert', title, message, onConfirm: null });
  };

  const getAdminSortedTasks = (tasksList) => {
    const list = [...tasksList];
    if (adminSortOrder === 'dueDate') {
      return list.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    } else if (adminSortOrder === 'leastCompleted') {
      return list.sort((a, b) => {
        const aCompleted = targetMembers.filter(m => a.statuses[m.id] === 'completed').length;
        const bCompleted = targetMembers.filter(m => b.statuses[m.id] === 'completed').length;
        return aCompleted - bCompleted;
      });
    } else if (adminSortOrder === 'newest') {
      return list.sort((a, b) => b.id - a.id);
    }
    return list;
  };

  const getMemberSortedTasks = (tasksList, memberId) => {
    const list = [...tasksList];
    if (memberSortOrder === 'dueDate') {
      return list.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    } else if (memberSortOrder === 'incompleteFirst') {
      return list.sort((a, b) => {
        const aCompleted = a.statuses[memberId] === 'completed' ? 1 : 0;
        const bCompleted = b.statuses[memberId] === 'completed' ? 1 : 0;
        if (aCompleted !== bCompleted) return aCompleted - bCompleted;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
    }
    return list;
  };

  const handleOpenNewTaskModal = () => {
    if (taskTemplates.length > 0) {
      setNewTaskTitle(taskTemplates[0]);
      setTaskInputMode('select');
    } else {
      setNewTaskTitle('');
      setTaskInputMode('manual');
    }
    setNewTaskDueDate('');
    setNewTaskUrl('');
    setNewTaskIsRecurring(false);
    setShowNewTaskModal(true);
  };

  const handleInitiateAddTask = () => {
    if (!newTaskTitle || !newTaskDueDate) {
      showAlert('入力エラー', 'タスク名と期日を入力してください。');
      return;
    }
    
    const subject = mailTemplates.newTask.subject.replace(/{タスク名}/g, newTaskTitle).replace(/{期日}/g, newTaskDueDate);
    let body = mailTemplates.newTask.body.replace(/{タスク名}/g, newTaskTitle).replace(/{期日}/g, newTaskDueDate);
    
    if (newTaskUrl) body = body.replace(/{関連URL}/g, `■ 関連URL: ${newTaskUrl}`);
    else body = body.replace(/{関連URL}\n/g, '').replace(/{関連URL}/g, '');

    body = body.replace(/{アプリURL}/g, window.location.origin);
    
    setMailSubject(subject);
    setMailBody(body);
    
    setShowNewTaskModal(false);
    setShowEmailConfirmModal(true);
  };

  const confirmAndAddTask = async (mailMethod = 'gmail') => {
    const newId = Date.now().toString(); // FirestoreのドキュメントIDは文字列
    const newTask = {
      id: newId,
      title: newTaskTitle,
      dueDate: newTaskDueDate,
      isRecurring: newTaskIsRecurring,
      url: newTaskUrl,
      autoRemind: { enabled: newTaskAutoRemind, daysBefore: newTaskAutoRemindDays, time: newTaskAutoRemindTime },
      // 閲覧者以外の対象メンバーにのみステータスを割り当てる
      statuses: targetMembers.reduce((acc, m) => ({ ...acc, [m.id]: 'pending' }), {})
    };
    
    // 宛先を生成（閲覧者を除く全対象メンバー）
    const toEmails = targetMembers.map(m => m.email).filter(e => e).join(',');
    
    // 【修正点】ポップアップブロックを回避するため、Firestoreへの保存より「先に」メールを起動する
    if (mailMethod === 'mailto') {
      const mailtoLink = `mailto:${toEmails}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
      window.location.href = mailtoLink;
    } else {
      const gmailLink = `https://mail.google.com/a/fujitelecom.co.jp/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmails)}&su=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
      window.open(gmailLink, '_blank');
    }
    
    // その裏（バックグラウンド）でFirestoreにタスクを追加
    await setDoc(doc(db, 'tasks', newId), newTask);
    
    showToast(`「${newTaskTitle}」を追加しました`);
    
    setNewTaskTitle('');
    setNewTaskDueDate('');
    setNewTaskUrl('');
    setShowEmailConfirmModal(false);
  };

  const handleInitiateRemind = (task) => {
    const pendingMembers = targetMembers.filter(m => task.statuses[m.id] !== 'completed');
    if (pendingMembers.length === 0) return;

    setRemindTask(task);
    
    const subject = mailTemplates.remind.subject.replace(/{タスク名}/g, task.title).replace(/{期日}/g, task.dueDate);
    let body = mailTemplates.remind.body.replace(/{タスク名}/g, task.title).replace(/{期日}/g, task.dueDate);
    
    if (task.url) body = body.replace(/{関連URL}/g, `■ 関連URL: ${task.url}`);
    else body = body.replace(/{関連URL}\n/g, '').replace(/{関連URL}/g, '');

    body = body.replace(/{アプリURL}/g, window.location.origin);
    
    setMailSubject(subject);
    setMailBody(body);
    
    setShowRemindModal(true);
  };

  const confirmAndSendRemind = (mailMethod = 'gmail') => {
    const pendingMembers = targetMembers.filter(m => remindTask.statuses[m.id] !== 'completed');
    const toEmails = pendingMembers.map(m => m.email).filter(e => e).join(',');
    
    // 選択された方法でメールを起動
    if (mailMethod === 'mailto') {
      const mailtoLink = `mailto:${toEmails}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
      window.location.href = mailtoLink;
    } else {
      // fujitelecom.co.jp ドメインのアカウントを強制的に開くURLに変更
      const gmailLink = `https://mail.google.com/a/fujitelecom.co.jp/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmails)}&su=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;
      window.open(gmailLink, '_blank');
    }
    
    showToast(`メールを起動しました`);
    setShowRemindModal(false);
    setRemindTask(null);
  };

  const saveTemplate = (type) => {
    // テンプレート保存のロジックは今回はローカルStateに留めます（後でDB保存にもできます）
    showToast('現在の文面を保存しました');
  };

  const handleOpenEditTask = (task) => {
    setEditingTask(task);
    setEditTaskTitle(task.title);
    if (taskTemplates.includes(task.title)) setTaskInputMode('select');
    else setTaskInputMode('manual');
    setEditTaskDueDate(task.dueDate);
    setEditTaskIsRecurring(task.isRecurring);
    setEditTaskUrl(task.url || '');
    setShowEditTaskModal(true);
  };

  const confirmAndSaveEditTask = async () => {
    if (!editTaskTitle || !editTaskDueDate) {
      showAlert('入力エラー', 'タスク名と期日を入力してください。');
      return;
    }
    
    // Firestoreのタスクを更新
    await updateDoc(doc(db, 'tasks', editingTask.id), {
      title: editTaskTitle,
      dueDate: editTaskDueDate,
      isRecurring: editTaskIsRecurring,
      url: editTaskUrl
    });
    
    showToast(`「${editTaskTitle}」を更新しました`);
    setShowEditTaskModal(false);
    setEditingTask(null);
  };

  const toggleTaskStatus = async (taskId, memberId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const currentStatus = task.statuses[memberId];
    const newStatus = currentStatus === 'completed' ? 'pending' : 'completed';
    
    // Firestore上のステータスのみを部分更新
    await updateDoc(doc(db, 'tasks', taskId), {
      [`statuses.${memberId}`]: newStatus
    });
  };

  const deleteTask = (taskId) => {
    showConfirm('タスクの削除', 'このタスクを削除してもよろしいですか？\n関連する進捗データもすべて消去されます。', async () => {
      // Firestoreから削除
      await deleteDoc(doc(db, 'tasks', taskId));
      
      if (hoveredTaskId === taskId) setHoveredTaskId(null);
      if (remindTask?.id === taskId) setRemindTask(null);
      if (editingTask?.id === taskId) setEditingTask(null);
      if (selectedCalendarTask?.id === taskId) setSelectedCalendarTask(null);
      showToast('タスクを削除しました');
    });
  };

  const handleOpenMemberModal = (member = null) => {
    if (member) {
      setEditingMember(member);
      setMemberFormName(member.name);
      setMemberFormRole(member.role);
      setMemberFormEmail(member.email || '');
    } else {
      setEditingMember(null);
      setMemberFormName('');
      setMemberFormRole('member');
      setMemberFormEmail('');
    }
    setShowMemberModal(true);
  };

  const handleSaveMember = async () => {
    if (!memberFormName) {
      showAlert('入力エラー', 'メンバーの名前を入力してください。');
      return;
    }
    
    if (editingMember) {
      if (editingMember.role === 'admin' && memberFormRole !== 'admin') {
        const adminCount = members.filter(m => m.role === 'admin').length;
        if (adminCount <= 1) {
          showAlert('エラー', 'システムに最低1人の管理者がいる必要があります。最後の管理者の権限を外すことはできません。');
          return;
        }
      }

      // Firestoreのメンバーを更新
      await updateDoc(doc(db, 'members', editingMember.id), {
        name: memberFormName, role: memberFormRole, email: memberFormEmail
      });
      showToast('メンバー情報を更新しました');
    } else {
      const newId = `m${Date.now()}`;
      const newMember = { id: newId, name: memberFormName, role: memberFormRole, email: memberFormEmail };
      
      // Firestoreに新しいメンバーを追加
      await setDoc(doc(db, 'members', newId), newMember);
      
      if (memberFormRole !== 'viewer') {
        // 新メンバーが閲覧者以外なら、すべてのタスクのstatusesに追加する
        tasks.forEach(async (t) => {
          await updateDoc(doc(db, 'tasks', t.id), {
            [`statuses.${newId}`]: 'pending'
          });
        });
      }
      showToast('メンバーを追加しました');
    }
    setShowMemberModal(false);
  };

  const handleDeleteMember = (memberId, memberName) => {
    if (currentUser && memberId === currentUser.id) {
      showAlert('エラー', '自分自身のアカウントを削除することはできません。');
      return;
    }

    const targetMember = members.find(m => m.id === memberId);
    if (targetMember && targetMember.role === 'admin') {
      const adminCount = members.filter(m => m.role === 'admin').length;
      if (adminCount <= 1) {
        showAlert('エラー', 'システムに最低1人の管理者がいる必要があります。最後の管理者は削除できません。');
        return;
      }
    }

    showConfirm('メンバーの削除', `${memberName}さんを削除してもよろしいですか？\n各タスクの進捗データからも削除されます。`, async () => {
      // Firestoreからメンバーを削除
      await deleteDoc(doc(db, 'members', memberId));
      
      // 各タスクのstatusesからこのメンバーの記録を消去する
      tasks.forEach(async (t) => {
         await updateDoc(doc(db, 'tasks', t.id), {
            [`statuses.${memberId}`]: deleteField()
         });
      });
      
      if (expandedMemberId === memberId) setExpandedMemberId(null);
      showToast(`${memberName}さんを削除しました`);
    });
  };

  const handleAddTaskTemplate = async () => {
    if (!newTaskTemplateName.trim()) {
      showAlert('入力エラー', 'タスク名を入力してください。');
      return;
    }
    if (taskTemplates.includes(newTaskTemplateName.trim())) {
      showAlert('エラー', 'すでに同じ名前が登録されています。');
      return;
    }
    const newTemplates = [...taskTemplates, newTaskTemplateName.trim()];
    // Firestoreの設定を更新
    await updateDoc(doc(db, 'settings', 'general'), { taskTemplates: newTemplates });
    setNewTaskTemplateName('');
    showToast('定型タスク名を追加しました');
  };

  const handleDeleteTaskTemplate = (templateName) => {
    showConfirm('定型タスク名の削除', `「${templateName}」を候補から削除してもよろしいですか？`, async () => {
      const newTemplates = taskTemplates.filter(t => t !== templateName);
      // Firestoreの設定を更新
      await updateDoc(doc(db, 'settings', 'general'), { taskTemplates: newTemplates });
      showToast('定型タスク名を削除しました');
      if (newTaskTitle === templateName) setNewTaskTitle('');
    });
  };

  const greeting = `${currentUser?.name || 'ゲスト'} さん`;

  const currentUserTasks = currentUser && currentUser.role !== 'viewer' ? getMemberSortedTasks(tasks, currentUser.id) : [];
  const currentUserCompletedCount = currentUserTasks.filter(t => t.statuses[currentUser.id] === 'completed').length;
  const currentUserPendingCount = currentUserTasks.length - currentUserCompletedCount;
  const currentUserOverdueCount = currentUserTasks.filter(t => {
    const isCompleted = t.statuses[currentUser.id] === 'completed';
    return isTaskOverdue(t.dueDate) && !isCompleted;
  }).length;

  let memberStatusMessage = '';
  if (currentUser?.role === 'viewer') {
    memberStatusMessage = '現在、チーム全体の進捗状況を閲覧しています。';
  } else if (currentUserTasks.length === 0) {
    memberStatusMessage = '現在、割り当てられているタスクはありません。';
  } else if (currentUserOverdueCount > 0) {
    memberStatusMessage = `※期限を過ぎているタスクが ${currentUserOverdueCount} 件あります。至急ご確認ください。`;
  } else if (currentUserPendingCount > 0) {
    memberStatusMessage = `現在、未完了のタスクが ${currentUserPendingCount} 件あります。`;
  } else {
    memberStatusMessage = '現在割り当てられているタスクはすべて完了しています。';
  }

  if (isAuthLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold text-gray-500">読み込み中...</div>;
  }

  // ▼▼▼ FirebaseのGoogleログイン画面 ▼▼▼
  if (!authUser) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md text-center animate-fade-in-up border-t-4 border-indigo-600">
          <div className="flex justify-center mb-4">
            <div className="bg-indigo-600 text-white p-3 rounded-xl shadow-sm">
              <CheckCircle size={32} />
            </div>
          </div>
          <h1 className="text-xl font-black text-gray-800 tracking-tight mb-2">リマインド・<span className="text-indigo-600">ナビゲーター</span></h1>
          <p className="text-sm text-gray-600 mb-8 font-medium leading-relaxed">
            チームのタスク進捗を管理します。<br/>自社Googleアカウントでログインしてください。
          </p>
          
          <button 
            onClick={handleGoogleLogin}
            className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-bold py-3 px-4 rounded-lg shadow-sm transition-transform transform active:scale-95 flex items-center justify-center gap-3"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
              <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
              </g>
            </svg>
            Googleでログイン
          </button>
          
          {accessDeniedError && (
             <div className="mt-4 bg-red-50 p-4 rounded text-left border border-red-300 shadow-sm">
               <p className="text-red-700 text-xs font-bold whitespace-pre-wrap leading-relaxed">{accessDeniedError}</p>
             </div>
          )}

          {loginError && (
             <div className="mt-4 bg-red-50 p-4 rounded text-left border border-red-200">
               <p className="text-red-700 text-xs font-bold whitespace-pre-wrap leading-relaxed">{loginError}</p>
             </div>
          )}
        </div>
      </div>
    );
  }

  // currentUserの準備ができるまでローディング表示
  if (!currentUser) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold text-gray-500">データを読み込んでいます...</div>;
  }

  const userRole = currentUser.role;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-20">
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4">
          
          {/* 上段：ロゴ ＆ (スマホ用プロフィール) */}
          <div className="flex justify-between items-center w-full md:w-auto">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 text-white p-1.5 rounded-lg shadow-sm">
                <CheckCircle size={24} />
              </div>
              <h1 className="text-xl font-black text-gray-800 tracking-tight">リマインド・<span className="text-indigo-600">ナビゲーター</span></h1>
            </div>

            {/* スマホ用プロフィールアイコン (md未満で表示) */}
            <div className="md:hidden relative">
              <button 
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shadow-sm transition-transform active:scale-95"
              >
                {currentUser.name.charAt(0)}
              </button>
            </div>
          </div>
          
          {/* 下段：メニュータブ ＆ (PC用プロフィール) */}
          <div className="flex items-center w-full md:w-auto">
            {/* メニュータブ (スマホ時は2x2グリッド、PC時は横1列) */}
            <div className="grid grid-cols-2 md:flex bg-gray-100 p-1 rounded-lg w-full md:w-auto gap-1">
              {/* 管理者と閲覧者はダッシュボードタブを表示 */}
              {(userRole === 'admin' || userRole === 'viewer') && (
                <button 
                  onClick={() => setViewMode('admin')}
                  className={`flex items-center justify-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-md text-sm font-bold transition-all ${
                    viewMode === 'admin' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {userRole === 'viewer' ? <Eye size={18} className="shrink-0" /> : <LayoutDashboard size={18} className="shrink-0" />}
                  <span className="truncate">{userRole === 'viewer' ? '全体進捗' : '管理者'}</span>
                </button>
              )}

              <button 
                onClick={() => setViewMode('calendar')}
                className={`flex items-center justify-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-md text-sm font-bold transition-all ${
                  viewMode === 'calendar' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Calendar size={18} className="shrink-0" />
                <span className="truncate">カレンダー</span>
              </button>

              {/* メンバー管理タブは管理者のみ */}
              {userRole === 'admin' && (
                <button 
                  onClick={() => setViewMode('manage_members')}
                  className={`flex items-center justify-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-md text-sm font-bold transition-all ${
                    viewMode === 'manage_members' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <Users size={18} className="shrink-0" />
                  <span className="truncate">メンバー管理</span>
                </button>
              )}

              {/* 自分のタスク画面はメンバーと管理者に表示（閲覧者には非表示） */}
              {(userRole === 'admin' || userRole === 'member') && (
                <button 
                  onClick={() => setViewMode('member')}
                  className={`flex items-center justify-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-md text-sm font-bold transition-all ${
                    viewMode === 'member' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  <User size={18} className="shrink-0" />
                  <span className="truncate">私のタスク</span>
                </button>
              )}
            </div>

            {/* PC用プロフィール (md以上で表示) */}
            <div className="hidden md:flex relative border-l border-gray-200 pl-4 ml-4 items-center">
              <button 
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shadow-sm shrink-0">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-bold text-gray-800 leading-tight truncate max-w-[120px]">{currentUser.name}</span>
                  <span className="text-[10px] text-gray-500 font-medium truncate max-w-[120px]">{authUser.email}</span>
                </div>
                <ChevronDown size={14} className="text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* プロフィール ドロップダウンメニュー (スマホ・PC共通) */}
        {isProfileMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)}></div>
            <div className="absolute right-4 top-14 md:top-16 mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-fade-in-up">
              <div className="md:hidden px-4 py-3 border-b border-gray-100 bg-gray-50">
                <div className="text-sm font-bold text-gray-800 truncate">{currentUser.name}</div>
                <div className="text-[10px] text-gray-500 truncate mt-0.5">{authUser.email}</div>
              </div>
              
              {/* CSVダウンロードボタン (管理者と閲覧者のみ表示) */}
              {(userRole === 'admin' || userRole === 'viewer') && (
                <button 
                  onClick={exportToCSV}
                  className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-2 text-sm font-bold transition-colors border-b border-gray-100"
                >
                  <Download size={16} />
                  CSVをダウンロード
                </button>
              )}
              
              <button 
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 flex items-center gap-2 text-sm font-bold transition-colors"
              >
                <LogOut size={16} />
                ログアウト
              </button>
            </div>
          </>
        )}
      </header>

      {/* Main Content View */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        
        {}
        {viewMode === 'admin' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <LayoutDashboard className="text-indigo-600" />
                  タスク進捗ダッシュボード
                </h2>
                <p className="text-gray-600 text-sm mt-1 font-medium">チーム全体の状況を把握し、遅れているメンバーにリマインドを送れます。</p>
              </div>
              
              {/* 管理者のみ操作ボタンを表示 */}
              {userRole === 'admin' && (
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-center">
                  <button 
                    onClick={handleOpenNewTaskModal}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto"
                  >
                    <Plus size={20} />
                    <span>新しいタスクを追加</span>
                  </button>
                  <button 
                    onClick={() => setShowTaskTemplateModal(true)}
                    className="bg-transparent hover:bg-gray-100 border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 transition-colors w-full sm:w-auto"
                  >
                    <Pencil size={16} />
                    <span>定型タスク編集</span>
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 左カラム：タスク一覧 */}
              <div className="lg:col-span-1 space-y-4">
                <div className="flex flex-row items-center justify-between border-b border-gray-200 pb-2 gap-2">
                  <h3 className="font-bold text-lg text-gray-800 flex items-center gap-1.5 sm:gap-2">
                    <Clock size={18} className="text-gray-600" />
                    <span className="truncate">管理中のタスク</span>
                  </h3>
                  <div className="flex items-center gap-1 text-xs sm:text-sm bg-white px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-md border border-gray-200 shadow-sm shrink-0">
                    <ArrowUpDown size={14} className="text-gray-500 hidden sm:block" />
                    <select 
                      value={adminSortOrder}
                      onChange={(e) => setAdminSortOrder(e.target.value)}
                      className="bg-transparent text-gray-700 font-bold focus:outline-none cursor-pointer"
                    >
                      <option value="dueDate">期日が近い順</option>
                      <option value="leastCompleted">未完了が多い順</option>
                      <option value="newest">新しく追加した順</option>
                    </select>
                  </div>
                </div>
                {getAdminSortedTasks(tasks).map(task => {
                  const completedCount = targetMembers.filter(m => task.statuses[m.id] === 'completed').length;
                  const totalCount = targetMembers.length;
                  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                  const isAllDone = totalCount > 0 && completedCount === totalCount;

                  return (
                    <div 
                      key={task.id} 
                      onClick={() => {
                        setSelectedCalendarTask(task);
                        setShowCalendarTaskModal(true);
                      }}
                      className={`bg-white rounded-xl shadow-sm border-l-4 p-4 hover:shadow-md cursor-pointer hover:bg-gray-50 transition-all ${isAllDone ? 'border-green-500 opacity-75' : 'border-indigo-500'}`}
                      title="クリックして詳細を確認"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-gray-800 leading-tight flex items-center gap-1.5">
                          {task.title}
                        </h4>
                        
                        {/* 編集・削除は管理者のみ */}
                        {userRole === 'admin' && (
                          <div className="flex items-center gap-1">
                            <button onClick={(e) => { e.stopPropagation(); handleOpenEditTask(task); }} className="text-gray-400 hover:text-blue-600 transition-colors p-2" title="編集">
                              <Pencil size={22} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className="text-gray-400 hover:text-red-500 transition-colors p-2" title="削除">
                              <Trash2 size={22} />
                            </button>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-3">
                        <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded">
                          <Calendar size={14} />
                          <span className={isTaskOverdue(task.dueDate) && !isAllDone ? 'text-red-600 font-bold' : ''}>
                            {task.dueDate}
                          </span>
                        </div>
                        {task.url && (
                          <a onClick={(e) => e.stopPropagation()} href={task.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-indigo-600 hover:underline bg-indigo-50 px-2 py-1 rounded">
                            <LinkIcon size={14} /> リンク
                          </a>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-gray-600">
                          <span>完了状況</span>
                          <span className={isAllDone ? 'text-green-600 font-bold' : ''}>{completedCount} / {totalCount} 名</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${isAllDone ? 'bg-green-500' : 'bg-indigo-500'}`} 
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>

                      {!isAllDone && (
                        <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                          <span className="text-xs text-orange-600 font-bold">未完了: {totalCount - completedCount}名</span>
                          
                          {/* リマインド送信は管理者のみ */}
                          {userRole === 'admin' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleInitiateRemind(task); }}
                              className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1.5 rounded-md font-bold flex items-center gap-1 transition-colors"
                            >
                              <Mail size={14} />
                              Gmailでリマインド
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 右カラム：マトリックス表示 */}
              <div className="lg:col-span-2">
                <div className="hidden md:flex bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-col h-full">
                  <div className="p-4 border-b border-gray-200 bg-gray-50 shrink-0">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                      <Users size={18} />
                      メンバー別 完了状況
                    </h3>
                  </div>
                  <div 
                    className="overflow-auto max-h-[600px] relative"
                    onMouseLeave={() => {
                      setHoveredTaskId(null);
                      setHoveredMemberId(null);
                    }}
                  >
                    <table className="w-full text-sm text-left border-separate border-spacing-0">
                      <thead className="text-xs text-gray-700 uppercase sticky top-0 z-20">
                        <tr>
                          <th className="px-4 py-3 font-medium min-w-[120px] sticky left-0 z-30 bg-gray-100 border-r border-b border-gray-200 shadow-[1px_0_0_0_rgba(0,0,0,0.05)]">
                            メンバー
                          </th>
                          {getAdminSortedTasks(tasks).map(task => (
                            <th 
                              key={task.id} 
                              className={`px-4 py-3 font-medium text-center min-w-[120px] max-w-[160px] truncate border-b border-gray-200 transition-colors ${
                                (ENABLE_CROSS_HIGHLIGHT && hoveredTaskId === task.id) ? 'bg-indigo-100' : 'bg-gray-50'
                              }`} 
                              title={task.title}
                              onMouseEnter={() => setHoveredTaskId(task.id)}
                            >
                              <div className="flex flex-col items-center gap-1">
                                <span className="truncate w-full">{task.title}</span>
                                <span className="text-[10px] bg-gray-200 px-1.5 rounded text-gray-600 font-bold">{task.dueDate.substring(5)}</span>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {targetMembers.map(member => {
                          const isRowHovered = ENABLE_CROSS_HIGHLIGHT && hoveredMemberId === member.id;
                          const memberTasks = tasks;
                          const totalTasks = memberTasks.length;
                          const completedTasks = memberTasks.filter(t => t.statuses[member.id] === 'completed').length;
                          const isAllCompleted = totalTasks > 0 && totalTasks === completedTasks;
                          
                          const hasOverdue = memberTasks.some(task => {
                            const isCompleted = task.statuses[member.id] === 'completed';
                            return isTaskOverdue(task.dueDate) && !isCompleted;
                          });

                          let nameCellColor = 'bg-white';
                          let rowBaseColor = 'bg-white';
                          
                          if (isAllCompleted) {
                            nameCellColor = 'bg-green-50';
                            rowBaseColor = 'bg-green-50/50';
                          } else if (hasOverdue) {
                            nameCellColor = 'bg-orange-50';
                            rowBaseColor = 'bg-orange-50/40';
                          }

                          if (isRowHovered) nameCellColor = 'bg-indigo-50';

                          return (
                            <tr key={member.id} className="transition-colors">
                              <td 
                                className={`px-4 py-3 sticky left-0 z-10 border-r border-b border-gray-100 shadow-[1px_0_0_0_rgba(0,0,0,0.02)] transition-colors ${nameCellColor}`}
                                onMouseEnter={() => setHoveredMemberId(member.id)}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-gray-800 whitespace-nowrap">{member.name}</span>
                                  {isAllCompleted && <span className="text-[10px] bg-green-200 text-green-800 px-1.5 py-0.5 rounded font-bold shrink-0">完了</span>}
                                  {hasOverdue && !isAllCompleted && <span className="text-[10px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded font-bold shrink-0">急ぎ</span>}
                                </div>
                              </td>
                              {getAdminSortedTasks(tasks).map(task => {
                                const isColHovered = ENABLE_CROSS_HIGHLIGHT && hoveredTaskId === task.id;
                                const isCellHovered = isRowHovered && isColHovered;
                                const isCompleted = task.statuses[member.id] === 'completed';
                                
                                let bgColorClass = rowBaseColor;
                                if (isCellHovered) bgColorClass = 'bg-indigo-100';
                                else if (isRowHovered || isColHovered) bgColorClass = 'bg-indigo-50/80';

                                return (
                                  <td 
                                    key={`${member.id}-${task.id}`} 
                                    className={`px-4 py-3 text-center border-b border-gray-100 transition-colors ${bgColorClass}`}
                                    onMouseEnter={() => {
                                      setHoveredTaskId(task.id);
                                      setHoveredMemberId(member.id);
                                    }}
                                  >
                                    <div 
                                      className={`inline-flex items-center justify-center p-1 rounded-full ${isCompleted ? 'text-green-600' : 'text-gray-300'}`}
                                      title={`${member.name}の「${task.title}」は${isCompleted ? '完了' : '未完了'}です`}
                                    >
                                      {isCompleted ? <CheckCircle size={26} className="fill-green-600 text-white" /> : <Circle size={26} />}
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* スマホ用カード表示 */}
                <div className="md:hidden flex flex-col space-y-3 mt-4">
                  <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-1 px-1">
                    <Users size={18} />
                    メンバー別 完了状況
                  </h3>
                  
                  {targetMembers.map(member => {
                    const isExpanded = expandedMemberId === member.id;
                    const memberTasks = tasks;
                    const totalTasks = memberTasks.length;
                    const completedTasks = memberTasks.filter(t => t.statuses[member.id] === 'completed').length;
                    const isAllCompleted = totalTasks > 0 && totalTasks === completedTasks;
                    const hasOverdue = memberTasks.some(task => {
                      const isCompleted = task.statuses[member.id] === 'completed';
                      return isTaskOverdue(task.dueDate) && !isCompleted;
                    });

                    let headerColor = 'bg-white';
                    let borderColor = 'border-gray-200';
                    if (isAllCompleted) {
                      headerColor = 'bg-green-50';
                      borderColor = 'border-green-200';
                    } else if (hasOverdue) {
                      headerColor = 'bg-orange-50';
                      borderColor = 'border-orange-200';
                    }

                    return (
                      <div key={member.id} className={`bg-white rounded-xl shadow-sm border ${borderColor} overflow-hidden transition-all`}>
                        <button 
                          onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                          className={`w-full px-4 py-3 flex items-center justify-between ${headerColor} transition-colors active:bg-gray-50`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-800">{member.name}</span>
                            <div className="flex gap-1">
                              {isAllCompleted && <span className="text-[10px] bg-green-200 text-green-800 px-1.5 py-0.5 rounded font-bold">完了</span>}
                              {hasOverdue && !isAllCompleted && <span className="text-[10px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded font-bold">急ぎ</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-gray-600 bg-white px-2 py-1 rounded shadow-sm border border-gray-100">
                              {completedTasks}/{totalTasks}
                            </span>
                            {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                          </div>
                        </button>
                        
                        {isExpanded && (
                          <div className="border-t border-gray-100 divide-y divide-gray-50">
                            {getAdminSortedTasks(tasks).map(task => {
                              const isCompleted = task.statuses[member.id] === 'completed';
                              const isOverdue = isTaskOverdue(task.dueDate) && !isCompleted;
                              
                              return (
                                <div key={task.id} className={`p-3 pl-4 flex items-center justify-between gap-3 ${isCompleted ? 'bg-gray-50/50' : 'bg-white'}`}>
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-bold truncate ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                                      {task.title}
                                    </p>
                                    <p className={`text-[11px] mt-0.5 flex items-center gap-1 ${isOverdue ? 'text-red-500 font-bold' : 'text-gray-600 font-medium'}`}>
                                      <Calendar size={12} />
                                      {task.dueDate.substring(5)} {isOverdue && '（超過）'}
                                    </p>
                                  </div>
                                  <div 
                                    className={`shrink-0 flex items-center justify-center p-2 rounded-full ${isCompleted ? 'text-green-600' : 'text-gray-300'}`}
                                  >
                                    {isCompleted ? <CheckCircle size={26} className="fill-green-600 text-white" /> : <Circle size={26} />}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {}
        {viewMode === 'calendar' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Calendar className="text-indigo-600" />
                  タスク・カレンダー
                </h2>
                <p className="text-gray-600 text-sm mt-1 font-medium">月別のタスクのスケジュールと進捗状況を確認します。</p>
              </div>
              {userRole === 'admin' && (
                <button 
                  onClick={handleOpenNewTaskModal}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto"
                >
                  <Plus size={20} />
                  <span>新しいタスクを追加</span>
                </button>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-12rem)] min-h-[500px]">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
                <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600">
                  <ChevronDown className="transform rotate-90" size={24} />
                </button>
                <h3 className="text-xl sm:text-2xl font-black text-gray-800">
                  {currentCalendarDate.getFullYear()}年 {currentCalendarDate.getMonth() + 1}月
                </h3>
                <button onClick={handleNextMonth} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-600">
                  <ChevronDown className="transform -rotate-90" size={24} />
                </button>
              </div>

              <div className="hidden sm:flex flex-1 flex-col min-h-0">
                <div className="grid grid-cols-7 border-b border-gray-200 shrink-0">
                  {['日', '月', '火', '水', '木', '金', '土'].map((day, idx) => (
                    <div key={day} className={`py-2 text-center text-sm font-bold ${idx === 0 ? 'text-red-500' : idx === 6 ? 'text-blue-500' : 'text-gray-500'}`}>
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 flex-1 overflow-y-auto bg-gray-50/30">
                  {getCalendarDays().map((dateObj, index) => {
                    if (!dateObj) {
                      const dayOfWeek = index % 7;
                      let emptyBg = 'bg-gray-50/80';
                      if (dayOfWeek === 0) emptyBg = 'bg-red-50/30';
                      else if (dayOfWeek === 6) emptyBg = 'bg-blue-50/30';
                      return <div key={`empty-${index}`} className={`border-b border-r border-gray-100 min-h-[120px] ${emptyBg}`}></div>;
                    }
                    
                    const todayObj = new Date();
                    const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
                    const isToday = dateObj.dateStr === todayStr;
                    const dayOfWeek = index % 7;

                    let cellBgClass = 'bg-white hover:bg-gray-50/50';
                    let dateTextColor = 'text-gray-600';
                    
                    if (isToday) {
                      cellBgClass = 'bg-yellow-50/40 hover:bg-yellow-100/50 ring-2 ring-yellow-400 ring-inset z-10 relative shadow-sm';
                    } else if (dayOfWeek === 0) {
                      cellBgClass = 'bg-red-50/20 hover:bg-red-50/50';
                      dateTextColor = 'text-red-500';
                    } else if (dayOfWeek === 6) {
                      cellBgClass = 'bg-blue-50/20 hover:bg-blue-50/50';
                      dateTextColor = 'text-blue-500';
                    }

                    const dayTasks = tasks.filter(t => t.dueDate === dateObj.dateStr);

                    return (
                      <div key={dateObj.dateStr} className={`border-b border-r border-gray-100 p-1 sm:p-2 min-h-[120px] flex flex-col gap-1 transition-colors ${cellBgClass}`}>
                        <div className={`text-right text-base font-bold mb-1.5 ${isToday ? 'bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center ml-auto shadow-sm' : dateTextColor}`}>
                          {dateObj.day}
                        </div>
                        <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto">
                          {dayTasks.map(task => {
                            const completedCount = targetMembers.filter(m => task.statuses[m.id] === 'completed').length;
                            const isAllDone = targetMembers.length > 0 && completedCount === targetMembers.length;
                            const isMemberView = userRole === 'member';
                            const isCurrentUserCompleted = task.statuses[currentUser.id] === 'completed';

                            const taskDate = new Date(task.dueDate.replace(/-/g, '/'));
                            taskDate.setHours(0, 0, 0, 0);
                            const todayDate = new Date();
                            todayDate.setHours(0, 0, 0, 0);
                            const diffDays = Math.ceil((taskDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

                            const isCompleted = isMemberView ? isCurrentUserCompleted : isAllDone;
                            const isOverdue = diffDays < 0 && !isCompleted;
                            const isApproaching = diffDays >= 0 && diffDays <= 3 && !isCompleted;

                            let badgeColor = 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
                            
                            if (isCompleted) badgeColor = 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 opacity-70';
                            else if (isOverdue) badgeColor = 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200 font-extrabold';
                            else if (isApproaching) badgeColor = 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200';

                            return (
                              <button 
                                key={task.id}
                                onClick={() => {
                                  setSelectedCalendarTask(task);
                                  setShowCalendarTaskModal(true);
                                }}
                                className={`text-left px-2 py-1.5 rounded border shadow-sm text-xs sm:text-sm font-bold truncate transition-colors cursor-pointer w-full flex flex-col gap-0.5 ${badgeColor}`}
                                title={task.title}
                              >
                                <span className={`truncate w-full ${isCompleted ? 'line-through' : ''}`}>{task.title}</span>
                                {isMemberView ? (
                                  <span className="text-[10px] sm:text-xs flex items-center gap-1">
                                    {isCurrentUserCompleted ? <CheckCircle size={12} /> : (isOverdue || isApproaching) ? <Clock size={12} /> : <Circle size={12} />}
                                    {isCurrentUserCompleted ? '完了済み' : isOverdue ? '期限切れ' : isApproaching ? '期限間近' : '未完了'}
                                  </span>
                                ) : (
                                  <span className="text-[10px] sm:text-xs flex items-center gap-1">
                                    {isAllDone ? <CheckCircle size={12} /> : (isOverdue || isApproaching) ? <Clock size={12} /> : <Circle size={12} />}
                                    {completedCount}/{targetMembers.length}名
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* スマホ用アジェンダ表示 */}
              <div className="sm:hidden flex-1 overflow-y-auto bg-gray-100 p-3">
                {(() => {
                  const year = currentCalendarDate.getFullYear();
                  const month = String(currentCalendarDate.getMonth() + 1).padStart(2, '0');
                  const monthPrefix = `${year}-${month}`;
                  
                  const monthTasks = tasks.filter(t => t.dueDate.startsWith(monthPrefix)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

                  if (monthTasks.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                        <Calendar size={48} className="mb-4 opacity-20" />
                        <p className="font-bold">この月のタスクはありません</p>
                      </div>
                    );
                  }

                  const tasksByDate = {};
                  monthTasks.forEach(t => {
                    if (!tasksByDate[t.dueDate]) tasksByDate[t.dueDate] = [];
                    tasksByDate[t.dueDate].push(t);
                  });

                  const today = new Date();
                  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

                  return (
                    <div className="space-y-4 pb-4">
                      {Object.keys(tasksByDate).sort().map(dateStr => {
                        const dateObj = new Date(dateStr.replace(/-/g, '/'));
                        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];
                        const isToday = dateStr === todayStr;
                        const dayTasks = tasksByDate[dateStr];

                        return (
                          <div key={dateStr} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className={`px-4 py-3 border-b flex items-center justify-between font-bold ${isToday ? 'bg-indigo-50 border-indigo-100 text-indigo-700' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
                              <div className="flex items-center gap-2">
                                <Calendar size={18} className={isToday ? 'text-indigo-600' : 'text-gray-500'} />
                                <span className="text-base">{dateObj.getDate()}日 ({dayOfWeek})</span>
                              </div>
                              {isToday && <span className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded-full shadow-sm">今日</span>}
                            </div>
                            
                            <div className="divide-y divide-gray-100">
                              {dayTasks.map(task => {
                                const completedCount = targetMembers.filter(m => task.statuses[m.id] === 'completed').length;
                                const isAllDone = targetMembers.length > 0 && completedCount === targetMembers.length;
                                const isMemberView = userRole === 'member';
                                const isCurrentUserCompleted = task.statuses[currentUser.id] === 'completed';

                                const taskDate = new Date(task.dueDate.replace(/-/g, '/'));
                                taskDate.setHours(0, 0, 0, 0);
                                const todayDate = new Date();
                                todayDate.setHours(0, 0, 0, 0);
                                const diffDays = Math.ceil((taskDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

                                const isCompleted = isMemberView ? isCurrentUserCompleted : isAllDone;
                                const isOverdue = diffDays < 0 && !isCompleted;
                                const isApproaching = diffDays >= 0 && diffDays <= 3 && !isCompleted;

                                let badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                                
                                if (isCompleted) badgeColor = 'bg-gray-100 text-gray-500 border-gray-200';
                                else if (isOverdue) badgeColor = 'bg-red-100 text-red-800 border-red-300';
                                else if (isApproaching) badgeColor = 'bg-yellow-100 text-yellow-800 border-yellow-300';

                                return (
                                  <button 
                                    key={task.id}
                                    onClick={() => {
                                      setSelectedCalendarTask(task);
                                      setShowCalendarTaskModal(true);
                                    }}
                                    className="w-full text-left p-4 hover:bg-gray-50 transition-colors flex flex-col gap-2.5"
                                  >
                                    <div className={`font-bold text-base leading-tight ${isMemberView ? (isCurrentUserCompleted ? 'text-gray-400 line-through' : 'text-gray-800') : (isAllDone ? 'text-gray-400 line-through' : 'text-gray-800')}`}>
                                      {task.title}
                                    </div>
                                    <div className="flex items-center justify-between w-full">
                                      {isMemberView ? (
                                        <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded border shadow-sm ${badgeColor}`}>
                                          {isCurrentUserCompleted ? <CheckCircle size={14} /> : (isOverdue || isApproaching) ? <Clock size={14} /> : <Circle size={14} />}
                                          あなたの状態: {isCurrentUserCompleted ? '完了' : isOverdue ? '期限切れ' : isApproaching ? '期限間近' : '未完了'}
                                        </div>
                                      ) : (
                                        <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded border shadow-sm ${badgeColor}`}>
                                          {isAllDone ? <CheckCircle size={14} /> : (isOverdue || isApproaching) ? <Clock size={14} /> : <Circle size={14} />}
                                          進捗: {completedCount}/{targetMembers.length}名
                                        </div>
                                      )}
                                      <span className="text-xs font-bold text-indigo-600 opacity-60">詳細を見る ＞</span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {}
        {viewMode === 'manage_members' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Users className="text-indigo-600" />
                  メンバー管理
                </h2>
                <p className="text-gray-600 text-sm mt-1 font-medium">チームメンバーの追加・編集・権限設定を行います。Googleアカウントのメールアドレスを正しく入力してください。</p>
              </div>
              <button 
                onClick={() => handleOpenMemberModal()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition-colors w-full sm:w-auto"
              >
                <Plus size={20} />
                <span>新しいメンバーを追加</span>
              </button>
            </div>

            <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600 w-16"></th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">名前</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">メールアドレス</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600">権限</th>
                    <th className="px-6 py-4 text-sm font-bold text-gray-600 text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg shadow-sm">
                          {member.name.charAt(0)}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-800 text-base">
                        {member.name}
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm">
                        {member.email ? (
                           <div className="flex items-center gap-1.5">
                             <Mail size={14} className="text-gray-400" />
                             {member.email}
                           </div>
                        ) : (
                          <span className="text-gray-400 italic">未設定</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {member.role === 'admin' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                            管理者
                          </span>
                        ) : member.role === 'viewer' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            閲覧者
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
                            メンバー
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleOpenMemberModal(member)}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="編集"
                          >
                            <Pencil size={22} />
                          </button>
                          {member.id !== currentUser.id && (
                            <button 
                              onClick={() => handleDeleteMember(member.id, member.name)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="削除"
                            >
                              <Trash2 size={22} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="sm:hidden space-y-3">
              {members.map((member) => (
                <div key={member.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between transition-colors hover:border-indigo-200">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xl shrink-0 shadow-sm">
                      {member.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-gray-800 text-base">{member.name}</div>
                      <div className="mt-1 flex flex-col gap-1">
                        {member.email && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                             <Mail size={12} />
                             {member.email}
                          </div>
                        )}
                        <div>
                          {member.role === 'admin' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                              管理者
                            </span>
                          ) : member.role === 'viewer' ? (
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              閲覧者
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                              メンバー
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button 
                      onClick={() => handleOpenMemberModal(member)}
                      className="p-2.5 text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors border border-gray-100 shadow-sm"
                    >
                      <Pencil size={22} />
                    </button>
                    {member.id !== currentUser.id && (
                      <button 
                        onClick={() => handleDeleteMember(member.id, member.name)}
                        className="p-2.5 text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg transition-colors border border-gray-100 shadow-sm"
                      >
                        <Trash2 size={22} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {}
        {viewMode === 'member' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-md">
              <h2 className="text-2xl font-bold mb-1">{greeting}</h2>
              <p className={`text-sm md:text-base font-bold ${currentUserOverdueCount > 0 ? 'text-red-200' : 'text-indigo-100'}`}>
                {memberStatusMessage}
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex flex-row items-center justify-between border-b border-gray-200 pb-2 gap-2">
                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-1.5 sm:gap-2">
                  <CheckCircle size={18} className="text-indigo-600" />
                  <span className="truncate">進行中のタスク</span>
                </h3>
                <div className="flex items-center gap-1 text-xs sm:text-sm bg-white px-1.5 sm:px-2 py-1 sm:py-1.5 rounded-md border border-gray-200 shadow-sm shrink-0">
                  <ArrowUpDown size={14} className="text-gray-500 hidden sm:block" />
                  <select 
                    value={memberSortOrder}
                    onChange={(e) => setMemberSortOrder(e.target.value)}
                    className="bg-transparent text-gray-700 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="incompleteFirst">未完了を優先表示</option>
                    <option value="dueDate">期日が近い順</option>
                  </select>
                </div>
              </div>
              
              {currentUserTasks.length === 0 ? (
                <div className="bg-gray-50 text-center py-10 rounded-xl border border-dashed border-gray-300 text-gray-600 font-bold">
                  現在、割り当てられているタスクはありません。
                </div>
              ) : (
                currentUserTasks.map(task => {
                  const isCompleted = task.statuses[currentUser.id] === 'completed';
                  const isOverdue = isTaskOverdue(task.dueDate) && !isCompleted;

                  return (
                    <div 
                      key={task.id} 
                      className={`bg-white rounded-xl shadow-sm border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                        isCompleted ? 'border-gray-200 opacity-60 bg-gray-50' : isOverdue ? 'border-red-300 shadow-red-50' : 'border-indigo-100 shadow-sm hover:shadow-md'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className={`text-lg font-bold ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                            {task.title}
                          </h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <div className={`flex items-center gap-1 px-2 py-1 rounded font-medium ${
                            isCompleted ? 'bg-gray-200 text-gray-600' : 
                            isOverdue ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            <Calendar size={14} />
                            期限: {task.dueDate} {isOverdue && '（期限切れ）'}
                          </div>
                          
                          {task.url && !isCompleted && (
                            <a 
                              href={task.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 hover:underline bg-indigo-50 px-2 py-1 rounded font-medium"
                            >
                              <ExternalLink size={14} /> リンク
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isCompleted ? (
                          <button 
                            onClick={() => toggleTaskStatus(task.id, currentUser.id)}
                            className="w-full sm:w-auto bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
                          >
                            完了済み (取り消す)
                          </button>
                        ) : (
                          <button 
                            onClick={() => {
                              toggleTaskStatus(task.id, currentUser.id);
                              showToast('タスクを完了しました！お疲れ様でした。');
                            }}
                            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm transition-all transform active:scale-95"
                          >
                            <CheckCircle size={20} />
                            完了にする
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      {}
      {/* 1. 新しいタスク追加モーダル */}
      {showNewTaskModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-base sm:text-lg text-gray-800">新しいタスクを追加</h3>
              <button onClick={() => setShowNewTaskModal(false)} className="text-gray-400 hover:text-gray-600 p-2 text-xl font-bold leading-none">✕</button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-bold text-gray-700">タスク名 <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                     <button
                        onClick={() => {
                          setTaskInputMode('select');
                          if (taskTemplates.length > 0 && !taskTemplates.includes(newTaskTitle)) {
                             setNewTaskTitle(taskTemplates[0]);
                          }
                        }}
                        className={`text-xs px-2 py-1 rounded font-bold transition-colors ${taskInputMode === 'select' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                     >
                        リストから選択
                     </button>
                     <button
                        onClick={() => {
                          setTaskInputMode('manual');
                          setNewTaskTitle('');
                        }}
                        className={`text-xs px-2 py-1 rounded font-bold transition-colors ${taskInputMode === 'manual' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                     >
                        直接入力
                     </button>
                  </div>
                </div>
                
                {taskInputMode === 'select' ? (
                  <select
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer bg-white font-bold"
                  >
                    {taskTemplates.length === 0 && <option value="" disabled>定型タスクが登録されていません</option>}
                    {taskTemplates.map((template, idx) => (
                      <option key={idx} value={template}>{template}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="例: Wevoxアンケート回答"
                  />
                )}
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">期日 <span className="text-red-500">*</span></label>
                <input 
                  type="date" 
                  value={newTaskDueDate}
                  onChange={(e) => setNewTaskDueDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">関連URL (オプション)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon size={16} className="text-gray-500" />
                  </div>
                  <input 
                    type="url" 
                    value={newTaskUrl}
                    onChange={(e) => setNewTaskUrl(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="https://"
                  />
                </div>
              </div>
            </div>
            
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={handleInitiateAddTask}
                className="px-6 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors flex items-center gap-2"
              >
                確認
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. 新規タスク通知メールの確認モーダル */}
      {showEmailConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-base sm:text-lg text-gray-800 flex items-center gap-2">
                <Mail className="text-indigo-600" />
                通知メールの確認
              </h3>
              <button onClick={() => setShowEmailConfirmModal(false)} className="text-gray-400 hover:text-gray-600 p-2 text-xl font-bold leading-none">✕</button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              <p className="text-xs sm:text-sm text-gray-600 font-bold mb-1 sm:mb-2">タスクを追加し、Gmailを起動します。</p>
              
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">件名</label>
                <input 
                  type="text" 
                  value={mailSubject}
                  onChange={(e) => setMailSubject(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">本文</label>
                <textarea 
                  value={mailBody}
                  onChange={(e) => setMailBody(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 h-24 sm:h-40 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                ></textarea>
              </div>
            </div>
            
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-3">
              <button 
                onClick={() => {
                  setShowEmailConfirmModal(false);
                  setShowNewTaskModal(true);
                }}
                className="px-4 py-2 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors w-full sm:w-auto text-center order-last sm:order-first"
              >
                戻る
              </button>
              <div className="flex flex-col sm:flex-row-reverse gap-2 w-full sm:w-auto">
                <button 
                  onClick={() => confirmAndAddTask('gmail')}
                  className="px-5 py-2.5 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Send size={16} /> Gmail (ブラウザ)
                </button>
                <button 
                  onClick={() => confirmAndAddTask('mailto')}
                  className="px-4 py-2.5 text-sm font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Mail size={16} /> 標準メール
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. リマインドメール確認モーダル */}
      {showRemindModal && remindTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden flex flex-col">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-base sm:text-lg text-gray-800">リマインドメールの確認</h3>
              <button onClick={() => setShowRemindModal(false)} className="text-gray-400 hover:text-gray-600 p-2 text-xl font-bold leading-none">✕</button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4">
              {(() => {
                const pendingMembers = targetMembers.filter(m => remindTask.statuses[m.id] !== 'completed');
                return (
                  <div className="bg-orange-50 border border-orange-100 p-2 sm:p-3 rounded-lg flex flex-col gap-1.5 sm:gap-2 text-orange-800 text-xs sm:text-sm mb-2 sm:mb-4">
                    <div className="flex gap-1.5 sm:gap-2 items-start">
                      <Bell size={18} className="shrink-0 text-orange-600 mt-0.5" />
                      <p className="font-bold">未完了のメンバー {pendingMembers.length} 名を宛先にしてGmailを起動します。</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5 ml-6 sm:ml-7">
                      {pendingMembers.map(m => (
                        <span key={m.id} className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-orange-200 text-orange-900 border border-orange-300">
                          {m.name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">件名</label>
                <input 
                  type="text" 
                  value={mailSubject}
                  onChange={(e) => setMailSubject(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div>
                <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">本文</label>
                <textarea 
                  value={mailBody}
                  onChange={(e) => setMailBody(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 h-24 sm:h-40 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                ></textarea>
              </div>
              
            </div>
            
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row-reverse justify-start gap-2 sm:gap-3">
              <button 
                onClick={() => confirmAndSendRemind('gmail')}
                className="px-5 py-2.5 text-sm font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Send size={16} /> Gmail (ブラウザ)
              </button>
              <button 
                onClick={() => confirmAndSendRemind('mailto')}
                className="px-4 py-2.5 text-sm font-bold text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Mail size={16} /> 標準メール
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. メンバー管理モーダル */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-base sm:text-lg text-gray-800">
                {editingMember ? 'メンバーを編集' : '新しいメンバーを追加'}
              </h3>
              <button onClick={() => setShowMemberModal(false)} className="text-gray-400 hover:text-gray-600 p-2 text-xl font-bold leading-none">✕</button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">名前 <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={memberFormName}
                  onChange={(e) => setMemberFormName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="例: 鈴木 一郎"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Googleメールアドレス <span className="text-red-500">*</span></label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail size={16} className="text-gray-500" />
                  </div>
                  <input 
                    type="email" 
                    value={memberFormEmail}
                    onChange={(e) => setMemberFormEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="例: suzuki@gmail.com"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">※このアドレスでログインした際に自動で権限が紐づきます。</p>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">権限</label>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-2 cursor-pointer bg-gray-50 p-2 rounded border border-gray-100 hover:bg-gray-100">
                    <input 
                      type="radio" 
                      name="role" 
                      value="member" 
                      checked={memberFormRole === 'member'}
                      onChange={() => setMemberFormRole('member')}
                      className="text-indigo-600 focus:ring-indigo-500 mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-gray-700 leading-none">メンバー</div>
                      <div className="text-xs text-gray-500 mt-1">タスクが割り当てられ、完了操作ができます。</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer bg-gray-50 p-2 rounded border border-gray-100 hover:bg-gray-100">
                    <input 
                      type="radio" 
                      name="role" 
                      value="admin" 
                      checked={memberFormRole === 'admin'}
                      onChange={() => setMemberFormRole('admin')}
                      className="text-indigo-600 focus:ring-indigo-500 mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-gray-700 leading-none">管理者</div>
                      <div className="text-xs text-gray-500 mt-1">メンバーの権限に加え、タスクの作成・管理ができます。</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer bg-purple-50 p-2 rounded border border-purple-100 hover:bg-purple-100">
                    <input 
                      type="radio" 
                      name="role" 
                      value="viewer" 
                      checked={memberFormRole === 'viewer'}
                      onChange={() => setMemberFormRole('viewer')}
                      className="text-purple-600 focus:ring-purple-500 mt-0.5"
                    />
                    <div>
                      <div className="font-bold text-gray-700 leading-none">閲覧者（モニタリング用）</div>
                      <div className="text-xs text-gray-500 mt-1">進捗状況の閲覧のみ可能。タスクは割り当てられません。</div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={handleSaveMember}
                className="px-4 py-2 text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors"
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. タスク編集モーダル */}
      {showEditTaskModal && editingTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-base sm:text-lg text-gray-800 flex items-center gap-2">
                <Pencil size={18} className="text-blue-600" />
                タスクを編集
              </h3>
              <button onClick={() => setShowEditTaskModal(false)} className="text-gray-400 hover:text-gray-600 p-2 text-xl font-bold leading-none">✕</button>
            </div>
            
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-bold text-gray-700">タスク名 <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                     <button
                        onClick={() => {
                          setTaskInputMode('select');
                          if (taskTemplates.length > 0 && !taskTemplates.includes(editTaskTitle)) {
                             setEditTaskTitle(taskTemplates[0]);
                          }
                        }}
                        className={`text-xs px-2 py-1 rounded font-bold transition-colors ${taskInputMode === 'select' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                     >
                        リストから選択
                     </button>
                     <button
                        onClick={() => {
                          setTaskInputMode('manual');
                        }}
                        className={`text-xs px-2 py-1 rounded font-bold transition-colors ${taskInputMode === 'manual' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                     >
                        直接入力
                     </button>
                  </div>
                </div>
                
                {taskInputMode === 'select' ? (
                  <select
                    value={editTaskTitle}
                    onChange={(e) => setEditTaskTitle(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer bg-white font-bold"
                  >
                    {taskTemplates.length === 0 && <option value="" disabled>定型タスクが登録されていません</option>}
                    {taskTemplates.map((template, idx) => (
                      <option key={idx} value={template}>{template}</option>
                    ))}
                  </select>
                ) : (
                  <input 
                    type="text" 
                    value={editTaskTitle}
                    onChange={(e) => setEditTaskTitle(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                )}
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">期日 <span className="text-red-500">*</span></label>
                <input 
                  type="date" 
                  value={editTaskDueDate}
                  onChange={(e) => setEditTaskDueDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">関連URL (オプション)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <LinkIcon size={16} className="text-gray-500" />
                  </div>
                  <input 
                    type="url" 
                    value={editTaskUrl}
                    onChange={(e) => setEditTaskUrl(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="https://"
                  />
                </div>
              </div>
            </div>
            
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button 
                onClick={confirmAndSaveEditTask}
                className="px-4 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
              >
                更新する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. カレンダー詳細モーダル */}
      {showCalendarTaskModal && selectedCalendarTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col animate-fade-in-up">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="font-bold text-base sm:text-lg text-gray-800 flex items-center gap-2">
                <Calendar size={18} className="text-indigo-600" /> タスクの状況確認
              </h3>
              <button onClick={() => {setShowCalendarTaskModal(false); setSelectedCalendarTask(null);}} className="text-gray-400 hover:text-gray-600 p-2 text-xl font-bold leading-none">✕</button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
              <div className="mb-4">
                <h4 className="text-lg sm:text-xl font-black text-gray-800 mb-1 leading-tight">{selectedCalendarTask.title}</h4>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-600 font-medium">
                  <Calendar size={14} /> 期限: {selectedCalendarTask.dueDate}
                </div>
              </div>

              <div className="space-y-1">
                {userRole === 'admin' || userRole === 'viewer' ? (
                  <>
                    <h5 className="text-[10px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 border-b border-gray-200 pb-1">メンバー別進捗</h5>
                    <div className="flex flex-col gap-1 pr-1">
                      {targetMembers.map(member => {
                        const isCompleted = selectedCalendarTask.statuses[member.id] === 'completed';
                        return (
                          <div key={member.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-100">
                            <div className="flex items-center gap-2">
                               <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {member.name.charAt(0)}
                                </div>
                               <span className={`text-xs sm:text-sm font-bold truncate ${isCompleted ? 'text-gray-500' : 'text-gray-800'}`}>{member.name}</span>
                            </div>
                            <div className="shrink-0 ml-2">
                               {isCompleted ? (
                                 <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-green-600 bg-green-50 px-1.5 sm:px-2 py-1 rounded">
                                   <CheckCircle size={12} className="sm:w-[14px] sm:h-[14px]" /> 完了
                                 </span>
                               ) : (
                                 <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-orange-600 bg-orange-50 px-1.5 sm:px-2 py-1 rounded">
                                   <Circle size={12} className="sm:w-[14px] sm:h-[14px]" /> 未完了
                                 </span>
                               )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <>
                    <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 border-b border-gray-200 pb-1">あなたの進捗</h5>
                    <div className="flex flex-col gap-1 pr-1 mt-2">
                      {(() => {
                        const isCompleted = selectedCalendarTask.statuses[currentUser.id] === 'completed';
                        return (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-xl bg-gray-50 border border-gray-200 gap-2">
                             <span className="font-bold text-gray-700 text-sm">現在のステータス</span>
                             <div className="shrink-0 self-start sm:self-auto">
                                {isCompleted ? (
                                  <span className="inline-flex items-center gap-1 text-sm font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                                    <CheckCircle size={16} /> 完了済み
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-sm font-bold text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200">
                                    <Circle size={16} /> 未完了
                                  </span>
                                )}
                             </div>
                          </div>
                        )
                      })()}
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-100 flex justify-between gap-3 shrink-0">
              {/* リマインド送信は管理者のみ */}
              {userRole === 'admin' ? (
                <button 
                  onClick={() => {
                    setShowCalendarTaskModal(false);
                    handleInitiateRemind(selectedCalendarTask);
                  }}
                  className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg shadow-sm transition-colors flex items-center gap-1"
                  disabled={targetMembers.filter(m => selectedCalendarTask.statuses[m.id] !== 'completed').length === 0}
                >
                  <Mail size={14} className="sm:w-[16px] sm:h-[16px]" /> リマインド送信
                </button>
              ) : (
                <div></div>
              )}
              <button 
                onClick={() => {setShowCalendarTaskModal(false); setSelectedCalendarTask(null);}}
                className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. 定型タスク名編集モーダル */}
      {showTaskTemplateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col animate-fade-in-up">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-base sm:text-lg text-gray-800 flex items-center gap-2">
                <Pencil size={18} className="text-indigo-600" /> 定型タスク名の編集
              </h3>
              <button onClick={() => setShowTaskTemplateModal(false)} className="text-gray-400 hover:text-gray-600 p-2 text-xl font-bold leading-none">✕</button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto max-h-[60vh] space-y-4">
              <p className="text-sm text-gray-600 font-medium">
                タスクを追加する際に、プルダウンから選べる「よく使うタスク名」を登録・削除できます。
              </p>

              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newTaskTemplateName}
                  onChange={(e) => setNewTaskTemplateName(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="新しい定型タスク名を入力"
                />
                <button 
                  onClick={handleAddTaskTemplate}
                  className="px-4 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-bold rounded-lg transition-colors whitespace-nowrap"
                >
                  追加
                </button>
              </div>

              <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 text-xs font-bold text-gray-500">
                  登録済みの定型タスク名 ({taskTemplates.length}件)
                </div>
                <div className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {taskTemplates.length === 0 ? (
                    <div className="p-4 text-center text-gray-400 text-sm font-medium">登録されていません</div>
                  ) : (
                    taskTemplates.map((template, idx) => (
                      <div key={idx} className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
                        <span className="font-bold text-gray-700">{template}</span>
                        <button 
                          onClick={() => handleDeleteTaskTemplate(template)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="削除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button 
                onClick={() => setShowTaskTemplateModal(false)}
                className="px-4 py-2 text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors"
              >
                完了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. 共通ダイアログ・通知トースト */}
      {dialogConfig.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col animate-fade-in-up">
            <div className="p-4 sm:p-6">
              <h3 className={`font-black text-lg mb-2 flex items-center gap-2 ${dialogConfig.type === 'confirm' ? 'text-red-600' : 'text-gray-800'}`}>
                {dialogConfig.type === 'confirm' && <Trash2 size={20} />}
                {dialogConfig.title}
              </h3>
              <p className="text-gray-600 text-sm font-medium whitespace-pre-wrap leading-relaxed">
                {dialogConfig.message}
              </p>
            </div>
            
            <div className="px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              {dialogConfig.type === 'confirm' && (
                <button 
                  onClick={closeDialog}
                  className="px-4 py-2 text-sm font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  キャンセル
                </button>
              )}
              <button 
                onClick={() => {
                  if (dialogConfig.type === 'confirm' && dialogConfig.onConfirm) {
                    dialogConfig.onConfirm();
                  }
                  closeDialog();
                }}
                className={`px-4 py-2 text-sm font-bold text-white rounded-lg shadow-sm transition-colors ${
                  dialogConfig.type === 'confirm' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {dialogConfig.type === 'confirm' ? '削除する' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg font-bold text-sm flex items-center gap-2 z-50 animate-toast-fade-in-up">
          <CheckCircle size={18} className="text-green-400" />
          {toastMessage}
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.3s ease-out forwards;
        }

        @keyframes toastFadeInUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .animate-toast-fade-in-up {
          animation: toastFadeInUp 0.3s ease-out forwards;
        }

        /* ブラウザ標準のフォーカスリング（黒い枠線）をクリック時は非表示にする */
        *:focus {
          outline: none !important;
        }
        
        /* Tabキーなどのキーボード操作時はアクセシビリティのために紫色の枠線を表示 */
        button:focus-visible, a:focus-visible {
          outline: 2px solid #4f46e5 !important;
          outline-offset: 2px !important;
        }
      `}} />
    </div>
  );
}
