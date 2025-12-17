import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, MessageRole, Project, Folder, Layer } from './types';
import { editImageWithGemini, analyzeImageWithGemini, generateImageWithGemini } from './services/geminiService';
import { saveProjectDataToDB, getProjectDataFromDB, deleteProjectDataFromDB } from './services/db';
import { ChatBubble } from './components/ChatBubble';
import { LoadingSpinner } from './components/LoadingSpinner';
import { GenieLampAnimation } from './components/GenieLampAnimation';
import { HistoryPanel } from './components/HistoryPanel';
import { ImageCropper } from './components/ImageCropper';
import { ChatHistorySidebar } from './components/ChatHistorySidebar';
import { TextOverlayTool } from './components/TextOverlayTool';
import { RegionEditTool } from './components/RegionEditTool';
import { CreateFolderModal } from './components/CreateFolderModal';
import { LayerPanel } from './components/LayerPanel';
import { FeedbackModal } from './components/FeedbackModal';

// Define AIStudio interface locally to avoid global type conflicts
interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

// Helper to create a small thumbnail from a base64 string
const createThumbnail = (base64: string, maxWidth = 300): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Export as low-quality JPEG to save space
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      } else {
        resolve(base64); // Fallback
      }
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
};

// Helper: Flatten layers to a single base64 image (Composition)
// STRICTLY ENFORCES 16:9 (1920x1080)
const composeLayers = (layers: Layer[], width = 1920, height = 1080): Promise<string> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return resolve('');

    // Helper to draw a layer
    const drawLayer = async (layer: Layer) => {
      if (!layer.visible) return;

      // Save context for opacity/blending
      ctx.save();
      ctx.globalAlpha = typeof layer.opacity === 'number' ? layer.opacity : 1;
      if (layer.blendMode) {
        ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
      }

      // Draw self if src exists
      if (layer.src) {
        await new Promise<void>((res) => {
          const img = new Image();
          img.onload = () => {
            // Calculate Aspect Ratio Fit (Contain)
            const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
            const x = (canvas.width / 2) - (img.width / 2) * scale;
            const y = (canvas.height / 2) - (img.height / 2) * scale;

            // If it's a generated/edited layer (usually 16:9), it should fit perfectly.
            // If it's a drag-dropped user image, we center and contain it.
            // However, if the user explicitly wants to stretch, we'd need a flag. 
            // For now, "Contain" is the safest professional default for thumbnails.

            // Check if image is already 16:9 (within small tolerance) to avoid micro-gaps
            const imgAspect = img.width / img.height;
            const canvasAspect = canvas.width / canvas.height;
            if (Math.abs(imgAspect - canvasAspect) < 0.01) {
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            } else {
              ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
            }
            res();
          };
          img.onerror = () => res();
          img.src = layer.src!;
        });
      }

      // Restore context
      ctx.restore();

      // Draw children (recursively)
      if (layer.children) {
        for (const child of layer.children) {
          await drawLayer(child);
        }
      }
    };

    const drawAll = async () => {
      // Draw bottom-up (reverse array order if layers[0] is top)
      const reversed = [...layers].reverse();
      for (const layer of reversed) {
        await drawLayer(layer);
      }
      resolve(canvas.toDataURL('image/png'));
    };
    drawAll();
  });
};

const Studio: React.FC = () => {
  // --- State ---
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // Persistence Helper with better error handling and type checking
  const loadState = <T,>(key: string, defaultValue: T): T => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed === null ? defaultValue : parsed;
      }
    } catch (e) {
      console.warn(`Failed to load ${key} from storage`, e);
    }
    return defaultValue;
  };

  const [currentImage, setCurrentImage] = useState<string | null>(() => loadState('tg_currentImage', null));

  // Layer State
  const [layers, setLayers] = useState<Layer[]>(() => {
    // Attempt to load from storage or fallback to currentImage as background
    const savedLayers = loadState<Layer[]>('tg_layers', []);
    if (savedLayers.length > 0) return savedLayers;
    // Fallback migration
    const savedImg = loadState('tg_currentImage', null);
    if (savedImg) {
      return [{
        id: 'bg-layer',
        name: 'Background',
        type: 'image',
        visible: true,
        src: savedImg
      }];
    }
    return [];
  });

  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<'chat' | 'layers'>('chat');

  const [imageHistory, setImageHistory] = useState<string[]>(() => loadState('tg_imageHistory', []));
  const [historyIndex, setHistoryIndex] = useState<number>(() => {
    const val = loadState('tg_historyIndex', -1);
    return typeof val === 'number' ? val : -1;
  });
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => loadState('tg_activeProjectId', null));

  const [messages, setMessages] = useState<Message[]>(() => loadState('tg_messages', [
    {
      id: 'welcome',
      role: MessageRole.MODEL,
      text: "Hello! Drag and drop an image anywhere to get started, or upload a saved project file.",
      timestamp: Date.now()
    }
  ]));

  const [projects, setProjects] = useState<Project[]>(() => loadState('tg_projects', []));
  const [folders, setFolders] = useState<Folder[]>(() => loadState('tg_folders', []));
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingState, setLoadingState] = useState<'analyzing' | 'processing' | null>(null);

  const [isDragOver, setIsDragOver] = useState(false);

  // Drag State for Projects
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [pendingDropProjectId, setPendingDropProjectId] = useState<string | null>(null);

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderNameValue, setEditFolderNameValue] = useState("");

  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  // Editor Mode State (Edit vs Ask)
  const [inputMode, setInputMode] = useState<'edit' | 'ask'>('edit');
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [enableAnalysis, setEnableAnalysis] = useState(true);

  // Generation, Cropping & Text State
  const [generationSize, setGenerationSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [isCropping, setIsCropping] = useState(false);
  const [isAddingText, setIsAddingText] = useState(false);
  const [isRegionEditing, setIsRegionEditing] = useState(false);

  // Chat History Sidebar State
  const [showChatHistory, setShowChatHistory] = useState(false);

  // --- Refs ---
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectsEndRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const modeDropdownRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Compose layers whenever they change
  useEffect(() => {
    const updateComposite = async () => {
      if (layers.length === 0) {
        setCurrentImage(null);
        return;
      }
      const composite = await composeLayers(layers);
      setCurrentImage(composite);
    };
    updateComposite();
    safeSave('tg_layers', layers);
  }, [layers]);

  // Safe Save Helper
  const safeSave = (key: string, value: any) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e: any) {
      if (e.name === 'QuotaExceededError') {
        console.warn(`Storage quota exceeded for ${key}.`);
      }
    }
  };

  // Save state
  useEffect(() => { safeSave('tg_imageHistory', imageHistory); }, [imageHistory]);
  useEffect(() => { safeSave('tg_historyIndex', historyIndex); }, [historyIndex]);
  useEffect(() => { safeSave('tg_messages', messages); }, [messages]);
  useEffect(() => { safeSave('tg_activeProjectId', activeProjectId); }, [activeProjectId]);
  useEffect(() => { safeSave('tg_projects', projects); }, [projects]);
  useEffect(() => { safeSave('tg_folders', folders); }, [folders]);

  useEffect(() => {
    const checkKey = async () => {
      // Check for environment variable first
      if (process.env.API_KEY) {
        setHasApiKey(true);
        return;
      }

      const aistudio = (window as any).aistudio as AIStudio | undefined;
      if (aistudio) {
        try {
          const hasKey = await aistudio.hasSelectedApiKey();
          setHasApiKey(hasKey);
        } catch (e) {
          console.error("Failed to check API key status", e);
          setHasApiKey(false);
        }
      } else {
        setHasApiKey(false);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle clicking outside profile menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(event.target as Node)) {
        setShowModeDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Handlers ---

  const handleSelectKey = async () => {
    const aistudio = (window as any).aistudio as AIStudio | undefined;
    if (aistudio) {
      try {
        await aistudio.openSelectKey();
        setHasApiKey(true);
      } catch (e) {
        console.error("Key selection failed or cancelled", e);
      }
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    // Prevent the file drop overlay from appearing when dragging projects
    if (draggingProjectId) return;

    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) setIsDragOver(true);
  }, [isDragOver, draggingProjectId]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
      setIsDragOver(false);
    }
  }, []);

  const addMessage = (text: string, role: MessageRole, imageUrl?: string, isError: boolean = false) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString() + Math.random().toString(),
      role,
      text,
      imageUrl,
      timestamp: Date.now(),
      isError
    }]);
  };

  const processFile = (file: File) => {
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const json = JSON.parse(content);

          // Basic migration for new layer support
          if (json.imageHistory && Array.isArray(json.imageHistory) && json.messages) {
            // If legacy project, try to extract layers or use flat image
            if (json.layers) {
              setLayers(json.layers);
            } else {
              const img = json.currentImage || json.imageHistory[json.imageHistory.length - 1];
              setLayers([{ id: 'bg', name: 'Background', type: 'image', visible: true, src: img }]);
            }

            setImageHistory(json.imageHistory);
            setHistoryIndex(json.historyIndex ?? json.imageHistory.length - 1);
            setMessages(json.messages);
            setActiveProjectId(null);
            addMessage("Project loaded successfully.", MessageRole.SYSTEM);
          } else {
            addMessage("Invalid project file format.", MessageRole.SYSTEM, undefined, true);
          }
        } catch (err) {
          addMessage("Failed to parse project file.", MessageRole.SYSTEM, undefined, true);
        }
      };
      reader.readAsText(file);
      return;
    }

    if (!file.type.startsWith('image/')) {
      addMessage("Please upload a valid image file.", MessageRole.SYSTEM);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      // When new image dropped, it becomes the new Background
      setLayers([{
        id: Date.now().toString(),
        name: file.name,
        type: 'image',
        visible: true,
        src: base64
      }]);
      setImageHistory([base64]);
      setHistoryIndex(0);
      setActiveProjectId(null);
      addMessage("Image uploaded successfully!", MessageRole.SYSTEM);

      if (enableAnalysis) {
        setIsLoading(true);
        setLoadingState('analyzing');
        addMessage("Analyzing image for contextual suggestions...", MessageRole.SYSTEM);
        try {
          const analysis = await analyzeImageWithGemini(base64);
          addMessage(analysis, MessageRole.MODEL);
        } catch (err) {
          console.error("Analysis failed", err);
          addMessage("Could not complete AI analysis.", MessageRole.SYSTEM, undefined, true);
        } finally {
          setIsLoading(false);
          setLoadingState(null);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (draggingProjectId) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, [enableAnalysis, draggingProjectId]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  // History for LAYERS logic is complex. For now, we rely on the flat image history for undo/redo visual.
  // Ideally, undo/redo should revert the `layers` state.
  // Simplifying assumption: Undo restores the flat image as a single background layer.
  // This is a limitation of mixing flat AI generation with layered editing.
  const handleUndo = useCallback(() => {
    if (historyIndex > 0 && imageHistory.length > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      // Restore as flattened background
      setLayers([{ id: 'restored', name: 'Restored Version', type: 'image', visible: true, src: imageHistory[newIndex] }]);
    }
  }, [historyIndex, imageHistory]);

  const handleRedo = useCallback(() => {
    if (historyIndex < imageHistory.length - 1 && imageHistory.length > 0) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setLayers([{ id: 'restored', name: 'Restored Version', type: 'image', visible: true, src: imageHistory[newIndex] }]);
    }
  }, [historyIndex, imageHistory]);

  const handleHistorySelect = (index: number) => {
    if (index >= 0 && index < imageHistory.length) {
      setHistoryIndex(index);
      setLayers([{ id: 'restored', name: 'Restored Version', type: 'image', visible: true, src: imageHistory[index] }]);
    }
  };

  const handleClear = () => {
    setLayers([]);
    setCurrentImage(null);
    setImageHistory([]);
    setHistoryIndex(-1);
    setActiveProjectId(null);
    setMessages([{
      id: 'welcome',
      role: MessageRole.MODEL,
      text: "Hello! Drag and drop an image anywhere to get started, or upload a saved project file.",
      timestamp: Date.now()
    }]);
    localStorage.removeItem('tg_currentImage');
    localStorage.removeItem('tg_layers');
    localStorage.removeItem('tg_imageHistory');
    localStorage.removeItem('tg_historyIndex');
    localStorage.removeItem('tg_messages');
    localStorage.removeItem('tg_activeProjectId');
  };

  const handleExport = () => {
    if (!currentImage) return;
    const dummyUserName = "User";
    const randomNumber = Math.floor(Math.random() * 100000);
    const link = document.createElement('a');
    link.href = currentImage;
    link.download = `${dummyUserName}-thumbnail-${randomNumber}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveToLibrary = async () => {
    if (layers.length === 0) return;
    setIsLoading(true);
    try {
      const projectId = activeProjectId || Date.now().toString();
      // Wait for latest composite
      const finalImage = currentImage || await composeLayers(layers);
      const thumb = await createThumbnail(finalImage!);

      const projectData = { currentImage: finalImage, layers, imageHistory, historyIndex, messages };
      await saveProjectDataToDB(projectId, projectData);
      localStorage.removeItem(`tg_proj_${projectId}`);
      addMessage(activeProjectId ? "Project updated." : "Project saved to library.", MessageRole.SYSTEM);

      setProjects(prev => {
        const existingIdx = prev.findIndex(p => p.id === projectId);
        const existingProject = existingIdx >= 0 ? prev[existingIdx] : null;

        const newMeta: Project = {
          id: projectId,
          name: existingProject ? existingProject.name : `Project ${prev.length + 1}`,
          thumbnail: thumb,
          timestamp: Date.now(),
          folderId: existingProject ? existingProject.folderId : (currentFolderId || undefined)
        };
        return existingIdx >= 0 ? prev.map((p, i) => i === existingIdx ? newMeta : p) : [newMeta, ...prev];
      });
      setActiveProjectId(projectId);
      if (!activeProjectId) {
        setTimeout(() => {
          projectsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        }, 100);
      }
    } catch (error: any) {
      console.error("Save Error", error);
      alert(`Failed to save project: ${error.message}.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadProject = async (project: Project) => {
    setIsLoading(true);
    try {
      let data = await getProjectDataFromDB(project.id);
      if (!data) {
        const raw = localStorage.getItem(`tg_proj_${project.id}`);
        if (raw) try { data = JSON.parse(raw); } catch (e) { }
      }
      if (!data && project.data) data = project.data;

      if (data) {
        if (data.layers) {
          setLayers(data.layers);
        } else {
          setLayers([{ id: 'bg', name: 'Background', type: 'image', visible: true, src: data.currentImage }]);
        }
        setImageHistory(data.imageHistory || [data.currentImage]);
        setHistoryIndex(data.historyIndex ?? 0);
        setMessages(data.messages || []);
        setActiveProjectId(project.id);
        addMessage(`Loaded project "${project.name}".`, MessageRole.SYSTEM);
      } else {
        addMessage(`Failed to load data for "${project.name}".`, MessageRole.SYSTEM, undefined, true);
      }
    } catch (error) {
      console.error("Load Error", error);
      addMessage(`Error loading project: ${error}`, MessageRole.SYSTEM, undefined, true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this project?")) {
      setProjects(prev => prev.filter(p => p.id !== projectId));
      await deleteProjectDataFromDB(projectId);
      localStorage.removeItem(`tg_proj_${projectId}`);
      if (activeProjectId === projectId) setActiveProjectId(null);
    }
  };

  const handleCreateFolder = () => {
    setShowCreateFolderModal(true);
  };

  const handleFolderCreateConfirm = (name: string) => {
    const newFolderId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    const newFolder: Folder = {
      id: newFolderId,
      name: name,
      timestamp: Date.now(),
      parentId: currentFolderId || undefined
    };
    // Add to front of array
    setFolders(prev => [newFolder, ...prev]);

    // Check if we have a pending drop operation
    if (pendingDropProjectId) {
      setProjects(prev => prev.map(p => p.id === pendingDropProjectId ? { ...p, folderId: newFolderId } : p));
      setPendingDropProjectId(null);
    }
  };

  const handleDeleteFolder = (e: React.MouseEvent, folderId: string) => {
    e.stopPropagation();
    if (confirm("Delete this folder? Projects inside will be kept but moved to Home.")) {
      // Move projects to root by setting folderId to undefined
      setProjects(prev => prev.map(p => p.folderId === folderId ? { ...p, folderId: undefined } : p));
      setFolders(prev => prev.filter(f => f.id !== folderId));
      if (currentFolderId === folderId) setCurrentFolderId(null);
    }
  };

  // --- Drag and Drop Handlers for Organization ---

  const onProjectDragStart = (e: React.DragEvent, projectId: string) => {
    setDraggingProjectId(projectId);
    e.dataTransfer.setData('tg/project-id', projectId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onProjectDragEnd = (e: React.DragEvent) => {
    setDraggingProjectId(null);
    setIsDragOver(false);
  };

  const onFolderDragOver = (e: React.DragEvent) => {
    // Use state variable for robust detection of internal drag
    if (draggingProjectId) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      e.currentTarget.classList.add('bg-white/20', 'border-indigo-500');
    }
  };

  const onFolderDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Only remove highlight if we are truly leaving the folder card, 
    // not just entering a child element (like the icon or text)
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) {
      return;
    }

    e.currentTarget.classList.remove('bg-white/20', 'border-indigo-500');
  };

  const onFolderDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('bg-white/20', 'border-indigo-500');

    const pid = draggingProjectId || e.dataTransfer.getData('tg/project-id');

    if (pid) {
      setProjects(prev => prev.map(p => p.id === pid ? { ...p, folderId: targetId } : p));
    }
    setDraggingProjectId(null);
  };

  const onBackDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('bg-white/20', 'border-indigo-500');

    const pid = draggingProjectId || e.dataTransfer.getData('tg/project-id');

    if (pid && currentFolderId) {
      const folder = folders.find(f => f.id === currentFolderId);
      setProjects(prev => prev.map(p => p.id === pid ? { ...p, folderId: folder?.parentId } : p));
    }
    setDraggingProjectId(null);
  };

  const onNewFolderDragOver = (e: React.DragEvent) => {
    if (draggingProjectId) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      e.currentTarget.classList.add('bg-white/20', 'border-indigo-500');
    }
  };

  const onNewFolderDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('bg-white/20', 'border-indigo-500');

    const pid = draggingProjectId || e.dataTransfer.getData('tg/project-id');

    if (pid) {
      setPendingDropProjectId(pid);
      setShowCreateFolderModal(true);
    }
    setDraggingProjectId(null);
  };

  const startRenaming = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setEditingProjectId(project.id);
    setEditNameValue(project.name);
  };

  const saveRename = (projectId: string) => {
    if (editNameValue.trim()) {
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, name: editNameValue.trim() } : p));
    }
    setEditingProjectId(null);
  };

  const startFolderRenaming = (e: React.MouseEvent, folder: Folder) => {
    e.stopPropagation();
    setEditingFolderId(folder.id);
    setEditFolderNameValue(folder.name);
  };

  const saveFolderRename = (folderId: string) => {
    if (editFolderNameValue.trim()) {
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name: editFolderNameValue.trim() } : f));
    }
    setEditingFolderId(null);
  };

  const handleCropComplete = (croppedBase64: string) => {
    setIsCropping(false);
    // Replace Background or add as new layer?
    // Let's replace the bottom-most visible layer (Background)
    // Or just add a new layer "Cropped" on top.
    const newLayer: Layer = {
      id: Date.now().toString(),
      name: 'Cropped Image',
      type: 'image',
      visible: true,
      src: croppedBase64
    };
    setLayers([newLayer, ...layers]);
    // Also update history snapshot
    updateHistory(croppedBase64);
  };

  const handleTextApply = (newBase64: string) => {
    setIsAddingText(false);
    // TextOverlayTool returns a transparent PNG with text. Add as top layer.
    const newLayer: Layer = {
      id: Date.now().toString(),
      name: 'Text Layer',
      type: 'text',
      visible: true,
      src: newBase64
    };
    setLayers([newLayer, ...layers]);
    // We don't have the final composite yet for history, but useEffect will trigger and we can save snapshot then if needed.
    // However, to keep undo snappy, we might want to wait for composite.
  };

  const handleRegionApply = (prompt: string, coords: string) => {
    setIsRegionEditing(false);
    // Submit the edit request with the specific coordinates logic
    handleSubmit(undefined, `${prompt} strictly inside the region defined by bounding box ${coords} (scale 0-1000).`);
  };

  const handleRemoveBackground = async () => {
    if (!currentImage) return;

    const replacement = prompt("Describe the new background (e.g., 'solid red', 'beach scene'). Leave empty for transparent.");
    if (replacement === null) return;

    const promptText = replacement.trim()
      ? `Remove the background and replace it with ${replacement}.`
      : "Remove the background and make it transparent.";

    addMessage(promptText, MessageRole.USER);
    setIsLoading(true);
    setLoadingState('processing');

    try {
      const result = await editImageWithGemini(currentImage, promptText);
      if (result.image) {
        // Replace layers with new result (destructive edit on composite)
        const newLayer: Layer = {
          id: Date.now().toString(),
          name: 'AI Edit',
          type: 'image',
          visible: true,
          src: result.image
        };
        setLayers([newLayer]);
        updateHistory(result.image);
      }
      addMessage(result.text, MessageRole.MODEL, result.image);
    } catch (error: any) {
      addMessage(`Error: ${error.message}`, MessageRole.SYSTEM, undefined, true);
    } finally {
      setIsLoading(false);
      setLoadingState(null);
    }
  };

  const updateHistory = (image: string) => {
    const newHistory = imageHistory.slice(0, historyIndex + 1);
    newHistory.push(image);
    setImageHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Main Submit Handler
  const handleSubmit = async (e?: React.FormEvent, overridePrompt?: string) => {
    e?.preventDefault();
    const prompt = overridePrompt || inputValue.trim();
    if (!prompt) return;

    // Commands
    const cmd = prompt.toLowerCase();
    if (cmd === 'undo') { handleUndo(); setInputValue(""); return; }
    if (cmd === 'redo') { handleRedo(); setInputValue(""); return; }
    if (cmd === 'save') { handleSaveToLibrary(); setInputValue(""); return; }
    if (cmd === 'export') { handleExport(); setInputValue(""); return; }

    addMessage(prompt, MessageRole.USER);
    if (!overridePrompt) setInputValue("");

    setIsLoading(true);
    setLoadingState(inputMode === 'ask' ? 'analyzing' : 'processing');

    try {
      if (inputMode === 'ask' && currentImage) {
        // Ask Mode
        const analysis = await analyzeImageWithGemini(currentImage, prompt);
        addMessage(analysis, MessageRole.MODEL);
      } else {
        // Edit Mode
        let result;
        if (currentImage) {
          result = await editImageWithGemini(currentImage, prompt);
        } else {
          result = await generateImageWithGemini(prompt, generationSize);
        }

        if (result.image) {
          // New layer from AI result. Flatten.
          const newLayer: Layer = {
            id: Date.now().toString(),
            name: 'AI Generated',
            type: 'image',
            visible: true,
            src: result.image
          };
          setLayers([newLayer]);
          updateHistory(result.image);
          if (!currentImage) setActiveProjectId(null);
        }
        addMessage(result.text, MessageRole.MODEL, result.image);
      }

    } catch (error: any) {
      const errorMessage = error.message || "";
      if (errorMessage.includes("permission")) {
        addMessage("Access Denied. Please select a valid API Key.", MessageRole.SYSTEM, undefined, true);
        setHasApiKey(false);
      } else {
        addMessage(`Oops! Something went wrong: ${errorMessage}`, MessageRole.MODEL, undefined, true);
      }
    } finally {
      setIsLoading(false);
      setLoadingState(null);
    }
  };

  const handleReusePrompt = (text: string) => {
    setInputValue(text);
  };

  const handleAnalyzeClick = async () => {
    if (!currentImage) return;
    setIsLoading(true);
    setLoadingState('analyzing');
    addMessage("Analyzing image for contextual suggestions...", MessageRole.SYSTEM);
    try {
      const analysis = await analyzeImageWithGemini(currentImage);
      addMessage(analysis, MessageRole.MODEL);
    } catch (err) {
      addMessage("Could not complete AI analysis.", MessageRole.SYSTEM, undefined, true);
    } finally {
      setIsLoading(false);
      setLoadingState(null);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? handleRedo() : handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); handleRedo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSaveToLibrary(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleSaveToLibrary]);

  // --- Helpers ---
  const activeProject = projects.find(p => p.id === activeProjectId);
  const activeProjectIndex = (() => {
    if (!activeProjectId) return 0;
    const idx = projects.findIndex(p => p.id === activeProjectId);
    return idx !== -1 ? projects.length - idx : 0;
  })();

  const getFolderName = (id: string | null) => {
    if (!id) return null;
    return folders.find(f => f.id === id)?.name;
  };

  // Helper to normalize IDs for loose comparison (null vs undefined)
  const normalizeId = (id: string | null | undefined) => id || null;

  const visibleFolders = folders.filter(f => normalizeId(f.parentId) === normalizeId(currentFolderId));
  const visibleProjects = projects.filter(p => normalizeId(p.folderId) === normalizeId(currentFolderId));

  visibleProjects.sort((a, b) => b.timestamp - a.timestamp);
  visibleFolders.sort((a, b) => b.timestamp - a.timestamp);

  // Sorted list of all projects for the history sidebar
  const allProjectsSorted = [...projects].sort((a, b) => b.timestamp - a.timestamp);

  // Find last user message for "Regenerate" functionality
  const lastUserMessage = [...messages].reverse().find(m => m.role === MessageRole.USER);

  if (hasApiKey === null) return <div className="h-screen bg-[#050505] flex flex-col items-center justify-center space-y-4"><LoadingSpinner /><p className="text-gray-500 text-sm font-medium">Initializing Workspace...</p></div>;

  if (hasApiKey === false) {
    return (
      <div className="h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-[#121212] border border-white/5 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-blue-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Connect to Gemini</h1>
          <p className="text-gray-400 mb-6 text-sm leading-relaxed">To use the high-quality <span className="text-blue-400 font-mono text-xs">gemini-3-pro-image-preview</span> model, you must select an API Key from a paid Google Cloud Project.</p>
          <button onClick={handleSelectKey} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2">Select API Key</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh bg-black flex justify-center overflow-hidden font-sans text-gray-200">
      <div className="w-full max-w-[1200px] flex flex-col md:flex-row h-full bg-[#09090b] shadow-2xl relative" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>

        {isCropping && currentImage && <ImageCropper imageSrc={currentImage} onCropComplete={handleCropComplete} onCancel={() => setIsCropping(false)} />}
        {isAddingText && currentImage && <TextOverlayTool imageSrc={currentImage} onApply={handleTextApply} onCancel={() => setIsAddingText(false)} />}
        {isRegionEditing && currentImage && <RegionEditTool imageSrc={currentImage} onApply={handleRegionApply} onCancel={() => setIsRegionEditing(false)} />}

        {/* New Folder Modal */}
        <CreateFolderModal
          isOpen={showCreateFolderModal}
          onClose={() => {
            setShowCreateFolderModal(false);
            setPendingDropProjectId(null);
          }}
          onCreate={handleFolderCreateConfirm}
        />

        {/* Feedback Modal */}
        <FeedbackModal
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
        />

        {isDragOver && <div className="absolute inset-0 z-50 bg-blue-900/20 backdrop-blur-md border-4 border-blue-500/50 border-dashed m-4 rounded-3xl flex items-center justify-center pointer-events-none"><h2 className="text-3xl font-bold text-white">Drop to Upload</h2></div>}

        {/* Left Column (History & Projects) */}
        <div className="flex-col min-w-0 md:border-r border-white/5 bg-[#09090b] flex h-[55%] md:h-full md:flex-1 w-full order-1 relative">
          {showHistoryPanel && <HistoryPanel history={imageHistory} currentIndex={historyIndex} onSelect={handleHistorySelect} onClose={() => setShowHistoryPanel(false)} />}

          {/* Top Toolbar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl z-20 shrink-0">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-lg flex items-center justify-center"><svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" /></svg></div>
              <h1 className="text-lg font-semibold text-white hidden sm:block">ThumbGenie</h1>
              {activeProject && <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5"><span className="text-[10px] font-bold text-indigo-400">#{activeProjectIndex}</span><span className="text-xs font-medium text-gray-300 truncate max-w-[120px]">{activeProject.name}</span></div>}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleSaveToLibrary} disabled={!currentImage} className="hidden sm:block px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/5 text-gray-200 rounded-md">Save Project</button>
            </div>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 relative flex flex-col items-center justify-center p-4 md:p-6 overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-[#09090b] to-[#09090b]">
            {!currentImage && layers.length === 0 ? (
              <div className="text-center space-y-4 pointer-events-none border border-dashed border-white/10 p-10 rounded-3xl bg-white/5 backdrop-blur-sm max-w-[90%] md:max-w-none">
                <div className="w-20 h-20 bg-black/40 rounded-full mx-auto flex items-center justify-center border border-white/5"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor" className="w-8 h-8 text-gray-500"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg></div>
                <h3 className="text-lg font-medium text-gray-200">Start Creating</h3>
                <p className="text-sm text-gray-400 max-w-xs mx-auto leading-relaxed">
                  Upload an image to edit, or <span className="text-indigo-400">describe a new thumbnail</span> in the chat to generate one from scratch.
                </p>
                <div className="pt-4 pointer-events-auto"><label className="cursor-pointer bg-white/10 hover:bg-white/15 text-white px-5 py-2.5 rounded-full text-xs font-medium border border-white/5">Browse Files<input type="file" className="hidden" accept="image/*,.json" ref={fileInputRef} onChange={handleFileInput} /></label></div>
              </div>
            ) : (
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                {/* Render Layer Stack */}
                <div className="aspect-video relative shadow-2xl shadow-black rounded-lg overflow-hidden border border-white/5 max-w-full max-h-[calc(100%-5rem)] bg-[#050505] flex items-center justify-center">
                  {/* We display currentImage which is the COMPOSITE of all layers */}
                  {currentImage && (
                    <img src={currentImage} className="w-full h-full object-contain" />
                  )}

                  {isLoading && (
                    <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-50">
                      <GenieLampAnimation />
                      <p className="text-sm font-bold text-yellow-500 mt-6 tracking-widest uppercase animate-pulse shadow-yellow-500/50 drop-shadow-md">
                        {loadingState === 'analyzing' ? 'Consulting the Genie...' : 'Granting Your Wish...'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Floating Bottom Toolbar */}
                <div className="flex shrink-0 items-center gap-2 p-2 bg-[#1a1a1c]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 duration-500 mt-6 z-40">

                  {/* Undo/Redo Group */}
                  <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/5">
                    <button onClick={handleUndo} disabled={historyIndex <= 0} className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-30 text-gray-400 hover:text-white transition-colors" title="Undo">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>
                    </button>
                    <button onClick={handleRedo} disabled={historyIndex >= imageHistory.length - 1} className="p-2 hover:bg-white/10 rounded-lg disabled:opacity-30 text-gray-400 hover:text-white transition-colors" title="Redo">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" /></svg>
                    </button>
                  </div>

                  <div className="w-px h-8 bg-white/10 mx-1"></div>

                  {/* Tools Group */}
                  <div className="flex items-center gap-1">
                    <button onClick={() => setShowHistoryPanel(!showHistoryPanel)} className={`p-2.5 rounded-xl border border-transparent transition-all ${showHistoryPanel ? 'bg-indigo-600 text-white' : 'hover:bg-white/10 text-gray-400 hover:text-white'}`} title="History">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                      </svg>
                    </button>

                    <button onClick={() => setIsRegionEditing(true)} className="p-2.5 rounded-xl hover:bg-white/10 text-green-400 hover:text-green-300 transition-all border border-green-500/20 hover:border-green-500/50" title="Edit Region">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5a.75.75 0 0 1 .75-.75h.75v-3c0-.414.336-.75.75-.75H8.25v-.75a.75.75 0 0 1 1.5 0v.75H11.25V5a.75.75 0 0 1 1.5 0v.75H15V5a.75.75 0 0 1 1.5 0v.75h1.5c.414 0 .75.336.75.75v3h.75a.75.75 0 0 1 0 1.5h-.75v1.5h.75a.75.75 0 0 1 0 1.5h-.75v1.5h.75a.75.75 0 0 1 0 1.5h-.75c0 .414-.336.75-.75.75H18v.75a.75.75 0 0 1-1.5 0v-.75H15v.75a.75.75 0 0 1-1.5 0v-.75H11.25v.75a.75.75 0 0 1-1.5 0v-.75H8.25v.75a.75.75 0 0 1-1.5 0v-.75H5.25c-.414 0-.75-.336-.75-.75V18h-.75a.75.75 0 0 1 0-1.5h.75v-1.5h-.75a.75.75 0 0 1 0-1.5h.75v-1.5h-.75a.75.75 0 0 1 0-1.5Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
                      </svg>
                    </button>

                    <button onClick={() => setIsCropping(true)} className="p-2.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all" title="Crop">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M7.875 6h.875V3.75a.75.75 0 0 1 1.5 0V6h6.75a.75.75 0 0 1 .75.75v6.75h2.25a.75.75 0 0 1 0 1.5H18v.875a.75.75 0 0 1-1.5 0V15H9.75a.75.75 0 0 1-.75-.75V8.25H6.75a.75.75 0 0 1 0-1.5h1.125Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 18h12M6 18v-4.5" /></svg>
                    </button>

                    <button onClick={() => setIsAddingText(true)} className="p-2.5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-all" title="Add Text">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg>
                    </button>

                    <button onClick={handleRemoveBackground} className="p-2.5 rounded-xl hover:bg-white/10 text-purple-400 hover:text-purple-300 transition-all" title="Remove Background">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                      </svg>
                    </button>
                  </div>

                  <div className="w-px h-8 bg-white/10 mx-1"></div>

                  <button onClick={handleExport} className="p-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-black font-medium transition-all shadow-[0_0_15px_rgba(22,163,74,0.3)] hover:shadow-[0_0_20px_rgba(22,163,74,0.5)]" title="Download">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M12 9.75V1.5m0 0 2.25 2.25M12 1.5 9.75 3.75" /></svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Projects Strip */}
          <div className="h-32 md:h-48 bg-[#09090b] border-t border-white/5 flex flex-col shrink-0">
            {/* ... (Existing projects strip code remains identical) ... */}
            <div className="px-5 py-2.5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">My Projects</h3>
                <span className="bg-white/10 text-gray-400 text-[10px] px-1.5 py-px rounded-full">{projects.length}</span>
                {currentFolderId && (
                  <>
                    <span className="text-gray-600 text-[10px]">/</span>
                    <span className="text-[11px] font-semibold text-white uppercase tracking-widest">
                      {getFolderName(currentFolderId)}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleCreateFolder} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-medium text-gray-300 hover:text-white transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                  New Folder
                </button>
                <button onClick={handleClear} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-green-600/10 hover:bg-green-600/20 text-[10px] font-medium text-green-400 hover:text-green-300 border border-green-600/20 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  New Project
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-x-auto p-4 flex gap-4 no-scrollbar items-center">
              {/* Back Button */}
              {currentFolderId && (
                <div
                  onClick={() => {
                    const current = folders.find(f => f.id === currentFolderId);
                    setCurrentFolderId(current?.parentId || null);
                  }}
                  onDragOver={onBackDrop}
                  onDragLeave={onFolderDragLeave}
                  onDrop={onBackDrop}
                  className="group flex-shrink-0 w-24 md:w-32 h-24 md:h-32 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all"
                >
                  <span className="text-gray-400 group-hover:text-white font-bold text-2xl pointer-events-none">..</span>
                  <span className="text-[10px] text-gray-500 uppercase pointer-events-none">Back</span>
                </div>
              )}

              {/* Folders */}
              {visibleFolders.map(folder => (
                <div
                  key={folder.id}
                  onClick={() => setCurrentFolderId(folder.id)}
                  onDragOver={onFolderDragOver}
                  onDragLeave={onFolderDragLeave}
                  onDrop={(e) => onFolderDrop(e, folder.id)}
                  className="group flex-shrink-0 w-40 md:w-56 h-24 md:h-32 bg-[#121212] rounded-xl border border-white/5 hover:border-white/10 relative cursor-pointer flex flex-col items-center justify-center gap-3 transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-blue-400">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
                    </svg>
                  </div>

                  {editingFolderId === folder.id ? (
                    <input
                      autoFocus
                      value={editFolderNameValue}
                      onChange={e => setEditFolderNameValue(e.target.value)}
                      onBlur={() => saveFolderRename(folder.id)}
                      onKeyDown={e => e.key === 'Enter' && saveFolderRename(folder.id)}
                      onClick={e => e.stopPropagation()}
                      className="bg-black/50 text-xs text-white px-1 rounded w-[90%] text-center border border-indigo-500/50 z-10"
                    />
                  ) : (
                    <span
                      onClick={(e) => startFolderRenaming(e, folder)}
                      className="text-xs font-medium text-gray-400 group-hover:text-white transition-colors z-10 cursor-text hover:text-indigo-300 truncate max-w-[90%]"
                      title="Click to rename"
                    >
                      {folder.name}
                    </span>
                  )}

                  <button
                    onClick={(e) => handleDeleteFolder(e, folder.id)}
                    className="absolute top-2 right-2 p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" /></svg>
                  </button>
                </div>
              ))}

              {/* New Folder Button Card */}
              <button
                onClick={handleCreateFolder}
                onDragOver={onNewFolderDragOver}
                onDragLeave={onFolderDragLeave}
                onDrop={onNewFolderDrop}
                className="group flex-shrink-0 w-40 md:w-56 h-24 md:h-32 bg-white/5 hover:bg-white/10 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2 transition-all"
              >
                <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-white/10 flex items-center justify-center transition-colors pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-400 group-hover:text-white">
                    <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-gray-500 group-hover:text-gray-300 pointer-events-none">New Folder</span>
              </button>

              <button onClick={handleClear} className="group flex-shrink-0 w-40 md:w-56 h-24 md:h-32 bg-white/5 hover:bg-white/10 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-white/10 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg></div>
                <span className="text-xs font-medium text-gray-500">New Project</span>
              </button>
              {visibleProjects.map(p => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => onProjectDragStart(e, p.id)}
                  onDragEnd={onProjectDragEnd}
                  onClick={() => handleLoadProject(p)}
                  className={`flex-shrink-0 w-40 md:w-56 h-24 md:h-32 bg-[#121212] rounded-xl border relative overflow-hidden cursor-pointer ${activeProjectId === p.id ? 'border-indigo-500/50 ring-1 ring-indigo-500/20' : 'border-white/5'}`}
                >
                  <img src={p.thumbnail} className="w-full h-full object-cover opacity-60 hover:opacity-100 transition-opacity pointer-events-none" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
                    {editingProjectId === p.id ?
                      <input autoFocus value={editNameValue} onChange={e => setEditNameValue(e.target.value)} onBlur={() => saveRename(p.id)} onKeyDown={e => e.key === 'Enter' && saveRename(p.id)} className="bg-black/50 text-xs text-white px-1 rounded w-full border border-indigo-500/50 pointer-events-auto" /> :
                      <span className="text-xs font-medium text-white truncate block pointer-events-auto" onClick={e => startRenaming(e, p)}>{p.name}</span>
                    }
                    <span className="text-[10px] text-gray-500 block mt-0.5">{new Date(p.timestamp).toLocaleDateString()}</span>
                  </div>
                  <button onClick={e => handleDeleteProject(e, p.id)} className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-gray-400 hover:text-red-400 opacity-0 hover:opacity-100 transition-opacity pointer-events-auto"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" /></svg></button>
                </div>
              ))}
              <div ref={projectsEndRef} />
            </div>
          </div>
        </div>

        {/* Right Column (Chat & Layers) */}
        <div className="relative flex flex-col bg-[#09090b] border-t md:border-t-0 md:border-l border-white/5 w-full md:w-[350px] shrink-0 h-[45%] md:h-full order-2 z-10">

          {/* Tabs */}
          <div className="flex items-center p-1 bg-[#121212] border-b border-white/5">
            <button
              onClick={() => setRightPanelTab('chat')}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${rightPanelTab === 'chat' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              AI Assistant
            </button>
            <button
              onClick={() => setRightPanelTab('layers')}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${rightPanelTab === 'layers' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
            >
              Layers ({layers.length})
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden relative flex flex-col">
            {rightPanelTab === 'layers' ? (
              <LayerPanel
                layers={layers}
                onUpdate={setLayers}
                activeLayerId={activeLayerId}
                onSelectLayer={setActiveLayerId}
              />
            ) : (
              /* Chat Interface */
              <div className="flex flex-col h-full">
                {/* Chat Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                  {messages.map((msg) => (
                    <ChatBubble key={msg.id} message={msg} onReuse={handleReusePrompt} />
                  ))}
                  <div ref={chatEndRef} />
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-[#1a1a1c] border border-white/5 rounded-2xl rounded-bl-none px-4 py-3 shadow-lg flex items-center gap-3">
                        <LoadingSpinner />
                        <span className="text-xs text-gray-400 animate-pulse">
                          {loadingState === 'analyzing' ? 'Analyzing visual context...' : 'Generating pixel magic...'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-[#09090b] border-t border-white/5 relative">
                  {/* Mode Selector */}
                  <div className="absolute -top-10 left-4 flex items-center gap-2">
                    <div className="relative" ref={modeDropdownRef}>
                      <button
                        onClick={() => setShowModeDropdown(!showModeDropdown)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1a1c] border border-white/10 rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-colors shadow-lg"
                      >
                        <span className={`w-2 h-2 rounded-full ${inputMode === 'edit' ? 'bg-green-500' : 'bg-blue-500'}`}></span>
                        {inputMode === 'edit' ? 'Edit Mode' : 'Ask Mode'}
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-gray-500"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                      </button>
                      {showModeDropdown && (
                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-[#1a1a1c] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50 flex flex-col">
                          <button
                            onClick={() => { setInputMode('edit'); setShowModeDropdown(false); }}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left"
                          >
                            <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-500">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l2.846-.813a11.19 11.19 0 003.58-1.085l.478-.22a1.109 1.109 0 011.022-.054l2.917 1.397a.5.5 0 01.127.876l-2.175 3.394a1.109 1.109 0 00-.306 1.02l.626 4.383a.5.5 0 01-.84.478l-3.32-2.14a1.109 1.109 0 00-1.022-.054l-4.27 2.052a.5.5 0 01-.692-.619l1.397-2.917a1.109 1.109 0 00-.054-1.022l-1.085-3.58a.5.5 0 01.478-.84l4.383.626a1.109 1.109 0 001.02-.306l3.394-2.175a.5.5 0 01.876.127l1.397 2.917z" /></svg>
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">Edit Mode</div>
                              <div className="text-[10px] text-gray-500">Modify the image using AI commands</div>
                            </div>
                          </button>
                          <button
                            onClick={() => { setInputMode('ask'); setShowModeDropdown(false); }}
                            className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left border-t border-white/5"
                          >
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg>
                            </div>
                            <div>
                              <div className="text-xs font-bold text-white">Ask Mode</div>
                              <div className="text-[10px] text-gray-500">Get feedback and analysis</div>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Size Selector for Gen */}
                    {!currentImage && (
                      <select
                        value={generationSize}
                        onChange={(e) => setGenerationSize(e.target.value as any)}
                        className="px-2 py-1.5 bg-[#1a1a1c] border border-white/10 rounded-lg text-xs text-gray-400 outline-none focus:border-indigo-500"
                      >
                        <option value="1K">1K</option>
                        <option value="2K">2K</option>
                        <option value="4K">4K</option>
                      </select>
                    )}
                  </div>

                  <form onSubmit={(e) => handleSubmit(e)} className="relative">
                    <input
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder={inputMode === 'edit' ? (currentImage ? "Describe changes (e.g. 'Add a neon glow')..." : "Describe a thumbnail to generate...") : "Ask about the thumbnail..."}
                      className="w-full bg-[#1a1a1c] text-gray-200 placeholder-gray-500 text-sm rounded-xl pl-4 pr-12 py-3.5 border border-white/10 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all shadow-inner"
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      disabled={!inputValue.trim() || isLoading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 disabled:bg-gray-700 transition-all shadow-lg shadow-indigo-500/20"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                      </svg>
                    </button>
                  </form>
                  <div className="text-[10px] text-gray-600 mt-2 text-center">
                    {inputMode === 'edit' ? 'Use Ctrl+Z to Undo, Ctrl+Y to Redo' : 'Gemini 2.5 Flash analyzes your image'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Profile / Menu Bottom */}
          <div className="p-3 bg-[#09090b] border-t border-white/5 flex items-center justify-between" ref={profileMenuRef}>
            <div className="flex items-center gap-2 cursor-pointer hover:bg-white/5 p-1.5 rounded-lg transition-colors" onClick={() => setShowProfileMenu(!showProfileMenu)}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 border border-white/10 flex items-center justify-center text-xs font-bold text-white shadow-inner">
                U
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-medium text-white">User</span>
                <span className="text-[10px] text-gray-500">Free Plan</span>
              </div>
            </div>

            {showProfileMenu && (
              <div className="absolute bottom-16 left-4 w-48 bg-[#1a1a1c] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-2 duration-200">
                <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
                  <p className="text-xs text-white font-medium">Account</p>
                  <p className="text-[10px] text-gray-500">user@example.com</p>
                </div>
                <button onClick={handleSelectKey} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                  Change API Key
                </button>
                <button onClick={() => { setShowFeedbackModal(true); setShowProfileMenu(false); }} className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                  Share Feedback
                </button>
                <button className="w-full text-left px-4 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-white transition-colors">
                  Settings
                </button>
                <div className="border-t border-white/5 my-1"></div>
                <button onClick={() => window.location.reload()} className="w-full text-left px-4 py-2 text-xs text-red-400 hover:bg-white/5 transition-colors">
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar Overlay */}
      {showChatHistory && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setShowChatHistory(false)}></div>
      )}
      <div className={`fixed inset-y-0 right-0 w-80 bg-[#09090b] shadow-2xl transform transition-transform duration-300 z-50 border-l border-white/5 ${showChatHistory ? 'translate-x-0' : 'translate-x-full'}`}>
        <ChatHistorySidebar
          projects={allProjectsSorted}
          activeProjectId={activeProjectId}
          onSelect={(p) => { handleLoadProject(p); setShowChatHistory(false); }}
          onClose={() => setShowChatHistory(false)}
          onDelete={handleDeleteProject}
        />
      </div>

    </div>
  );
};

export default Studio;