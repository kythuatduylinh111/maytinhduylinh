import { useState, useRef, useEffect } from "react";
import { Search, Upload, Image as ImageIcon, FileText, Settings, Download, Copy, Check, Loader2, AlertCircle, HelpCircle, Globe, BadgeCheck, Save, Sun, Moon, Palette, Sparkles, Package, Info, Type, X, History, MoreVertical, Mic, Camera, Video, StopCircle, Trash2, Volume2, VolumeX, Type as FontIcon, Plus, ChevronDown, Send } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType } from "docx";
import { saveAs } from "file-saver";
import { generateProductContent, analyzeImageForName, type ProductContent, type ProcessingMode } from "./lib/gemini";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [productName, setProductName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<Record<string, boolean>>({});
  const [imageLoading, setImageLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [processingMode, setProcessingMode] = useState<ProcessingMode>("Chuyên nghiệp");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rawText, setRawText] = useState("");
  const [exporting, setExporting] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [themeColor, setThemeColor] = useState<ThemeKey>("blue");
  const [fontSize, setFontSize] = useState<"small" | "medium" | "large">("medium");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [focused, setFocused] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [advancedMode, setAdvancedMode] = useState<"text" | "voice" | "camera" | null>(null);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [lastVoiceText, setLastVoiceText] = useState("");
  const [permissionAlerted, setPermissionAlerted] = useState({ camera: false, mic: false });
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const cancelRefs = useRef<Record<string, boolean>>({});

  interface GenerationTask {
    id: string;
    productName: string;
    status: 'loading' | 'completed' | 'error' | 'paused';
    content?: ProductContent;
    error?: string;
    selectedImage?: string | null;
    processedImage?: string | null;
    processedLogo?: string | null;
    progress: number;
    mode: ProcessingMode;
  }

  type ThemeKey = "blue" | "indigo" | "emerald" | "rose";

  const CHANGELOG = [
    { version: "1.0.0", date: "2026-03-25", changes: ["Khởi tạo ứng dụng", "Tích hợp Gemini AI"] },
    { version: "1.1.0", date: "2026-03-27", changes: ["Thêm tính năng chèn Logo", "Tối ưu giao diện người dùng"] },
    { version: "1.2.0", date: "2026-03-29", changes: ["Thêm phím tắt bàn phím", "Tích hợp tìm kiếm ảnh Google"] },
    { version: "1.3.0", date: "2026-03-31", changes: ["Thêm tính năng xuất file Word", "Nén ảnh dưới 2MB"] },
    { version: "1.4.0", date: "2026-04-02", changes: ["Thêm thanh tiến trình", "Hiệu ứng Skeleton loading"] },
    { version: "1.4.1", date: "2026-04-03", changes: ["Sửa lỗi hiển thị ảnh", "Thêm Changelog & Versioning"] },
    { version: "1.5.0", date: "2026-04-09", changes: ["Sửa lỗi hiển thị ảnh (Lỗi Ảnh)", "Đồng bộ màu sắc tiêu đề theo chủ đề", "Cập nhật hệ thống đa nhiệm"] },
    { version: "1.6.0", date: "2026-04-09", changes: ["Thêm tính năng nhập liệu bằng Giọng nói (Mic)", "Thêm tính năng nhập liệu bằng Camera", "Tối ưu Tìm kiếm nâng cao"] },
    { version: "1.6.1", date: "2026-04-10", changes: ["Sửa lỗi không hiển thị Logo khi chèn", "Thêm nút xoá nhanh ảnh và logo trên khung hình"] },
    { version: "1.6.2", date: "2026-04-10", changes: ["Thêm nút Hoàn tác/Huỷ cho Giọng nói", "Nâng cấp hiệu ứng sóng âm", "Thiết kế lại nút Upload/Xoá ảnh & logo thông minh"] },
    { version: "1.6.3", date: "2026-04-10", changes: ["Tối ưu nút Xoá nhanh tìm kiếm", "Chuyển nút Tìm ảnh Internet vào trung tâm", "Cải thiện GUI Ghi âm với icon điều khiển", "Nâng cấp nút Upload/Xoá thông minh (giữ icon, đổi màu nền)"] },
    { version: "1.6.4", date: "2026-04-10", changes: ["Duy trì nút Tìm ảnh Internet khi đang tạo nội dung", "Loại bỏ hiệu ứng chờ xử lý gây mất giao diện", "Tối ưu thông báo cấp quyền Camera/Mic (chỉ hiện 1 lần)"] },
    { version: "1.6.5", date: "2026-04-10", changes: ["Sửa lỗi không hiển thị ảnh/logo khi tải lên thủ công", "Thêm tính năng xem trước ảnh tức thì (Instant Preview)", "Hỗ trợ tải lên ảnh sản phẩm trước khi tạo nội dung AI"] },
    { version: "1.7.0", date: "2026-04-10", changes: ["Thiết kế lại nút Chế độ xử lý 3D liền mạch", "Dời icon Upload/Logo lên thanh tiêu đề", "Thêm hiệu ứng Hover cho icon", "Nâng cấp Menu Cài đặt: Cỡ chữ, Âm thanh, Xoá tất cả", "Thêm màu nền Mesh Background"] },
    { version: "1.8.0", date: "2026-04-12", changes: ["Thiết kế lại GUI nhập liệu theo phong cách Copilot", "Tích hợp Chế độ xử lý vào thanh tìm kiếm (Smart Dropdown)", "Chuyển nút Tạo nội dung AI thành icon Sparkles cuối thanh nhập liệu", "Tối ưu hoá trải nghiệm người dùng với thanh công cụ tích hợp"] },
    { version: "2.0.0", date: "2026-04-12", changes: ["Nâng cấp giao diện tìm kiếm 2.0", "Thêm Thẻ sản phẩm & Từ khoá Yoast SEO tự động", "Bổ sung tính năng Tạm dừng xử lý", "Tích hợp thẻ SEO vào khung Hình ảnh & Logo"] },
    { version: "2.0.1", date: "2026-04-12", changes: ["Tối ưu độ tương phản giao diện Sáng/Tối", "Nâng cấp màu sắc tiêu đề Card (Gradient)", "Cải thiện khả năng đọc của văn bản"] },
    { version: "2.0.2", date: "2026-04-13", changes: ["Yêu cầu quyền Camera/Mic chỉ khi sử dụng tính năng", "Tối ưu hóa trải nghiệm khởi động ứng dụng"] },
  ];

  const APP_VERSION = "2.0.2";

  useEffect(() => {
    const intervals: Record<string, NodeJS.Timeout> = {};
    
    tasks.forEach(task => {
      if (task.status === 'loading') {
        intervals[task.id] = setInterval(() => {
          setTasks(prev => prev.map(t => {
            if (t.id === task.id && t.status === 'loading') {
              const nextProgress = t.progress + (95 - t.progress) * 0.1;
              return { ...t, progress: nextProgress };
            }
            return t;
          }));
        }, 200);
      }
    });

    return () => {
      Object.values(intervals).forEach(clearInterval);
    };
  }, [tasks.map(t => `${t.id}-${t.status}`).join(',')]);

  const activeTask = tasks.find(t => t.id === activeTaskId) || tasks[0];

  const themes = {
    blue: {
      primary: "bg-blue-600 hover:bg-blue-700",
      secondary: "bg-blue-50 text-blue-600 border-blue-200",
      accent: "bg-linear-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent",
      ring: "focus:ring-blue-500/10",
      border: "focus:border-blue-500",
      shadow: "shadow-blue-600/20",
      gradient: "from-blue-600 to-blue-400"
    },
    indigo: {
      primary: "bg-indigo-600 hover:bg-indigo-700",
      secondary: "bg-indigo-50 text-indigo-600 border-indigo-200",
      accent: "bg-linear-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent",
      ring: "focus:ring-indigo-500/10",
      border: "focus:border-indigo-500",
      shadow: "shadow-indigo-600/20",
      gradient: "from-indigo-600 to-indigo-400"
    },
    emerald: {
      primary: "bg-emerald-600 hover:bg-emerald-700",
      secondary: "bg-emerald-50 text-emerald-600 border-emerald-200",
      accent: "bg-linear-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent",
      ring: "focus:ring-emerald-500/10",
      border: "focus:border-emerald-500",
      shadow: "shadow-emerald-600/20",
      gradient: "from-emerald-600 to-emerald-400"
    },
    rose: {
      primary: "bg-rose-600 hover:bg-rose-700",
      secondary: "bg-rose-50 text-rose-600 border-rose-200",
      accent: "bg-linear-to-r from-rose-600 to-rose-400 bg-clip-text text-transparent",
      ring: "focus:ring-rose-500/10",
      border: "focus:border-rose-500",
      shadow: "shadow-rose-600/20",
      gradient: "from-rose-600 to-rose-400"
    }
  };

  const suggestions = [
    "Laptop Gaming", "Bàn phím cơ", "Chuột không dây", "Tai nghe chống ồn", "Màn hình 4K", "Ổ cứng SSD",
    "Loa Bluetooth", "Webcam HD", "Microphone", "Ghế Gaming", "Bàn làm việc", "Đèn bàn LED",
    "Sạc dự phòng", "Cáp sạc nhanh", "Hub USB-C", "Túi chống sốc", "Balo laptop", "Giá đỡ điện thoại"
  ];

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      // Don't intercept if typing in an input or textarea
      const isTyping = ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName);
      if (isTyping) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const url = event.target?.result as string;
              if (activeTaskId) {
                setTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, selectedImage: url, processedImage: null } : t));
              } else {
                setPendingImage(url);
              }
            };
            reader.readAsDataURL(file);
          }
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [activeTaskId]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input or textarea
      const isTyping = ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName);

      if (isTyping) {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
          handleGenerate();
        }
        return;
      }

      // Require Alt key for all shortcuts to avoid conflicts with browser shortcuts
      if (!e.altKey) return;

      const key = e.key.toLowerCase();

      // Mode shortcuts
      if (key === "1") setProcessingMode("Chính xác");
      if (key === "2") setProcessingMode("Tốc độ");
      if (key === "3") setProcessingMode("Chuyên nghiệp");

      // Action shortcuts
      if (key === "u") fileInputRef.current?.click();
      if (key === "l") logoInputRef.current?.click();
      if (key === "s") saveAll();
      if (key === "w") exportToWord();
      if (key === "d") setIsDarkMode(!isDarkMode);
      if (key === "h") setShowHelp(!showHelp);
      if (key === "c") setShowChangelog(!showChangelog);
      if (key === "m") setShowSettingsMenu(!showSettingsMenu);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [productName, processingMode, isDarkMode, showHelp, themeColor, activeTask]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogo(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!productName.trim()) return;
    
    const taskId = Math.random().toString(36).substring(7);
    const newTask: GenerationTask = {
      id: taskId,
      productName,
      status: 'loading',
      progress: 0,
      mode: processingMode,
      selectedImage: pendingImage
    };

    setTasks(prev => [newTask, ...prev]);
    setActiveTaskId(taskId);
    // setProductName(""); // Keep search text as requested
    setRawText(""); // Clear advanced text
    setPendingImage(null); // Clear pending image
    cancelRefs.current[taskId] = false;

    try {
      const result = await generateProductContent({
        productName: newTask.productName,
        mode: newTask.mode,
        rawText: showAdvanced ? rawText : undefined,
        imageBase64: newTask.selectedImage || undefined
      });
      
      if (cancelRefs.current[taskId]) return;

      setTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          const firstImage = result.imageUrls.length > 0 ? result.imageUrls[0] : null;
          return { 
            ...t, 
            status: 'completed', 
            content: result, 
            progress: 100,
            selectedImage: t.selectedImage || firstImage
          };
        }
        return t;
      }));
    } catch (err) {
      if (cancelRefs.current[taskId]) return;
      console.error(err);
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: 'error', error: "Có lỗi xảy ra khi tạo nội dung. Vui lòng thử lại." } : t
      ));
    }
  };

  const handleCancel = (taskId: string) => {
    cancelRefs.current[taskId] = true;
    setTasks(prev => prev.filter(t => t.id !== taskId));
    if (activeTaskId === taskId) {
      setActiveTaskId(null);
    }
  };

  const handlePause = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        return { ...t, status: t.status === 'paused' ? 'loading' : 'paused' };
      }
      return t;
    }));
  };

  const handleNewTask = () => {
    setProductName("");
    setRawText("");
    setPendingImage(null);
    setActiveTaskId(null);
    setShowAdvanced(false);
    setAdvancedMode(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.");
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = 'vi-VN';
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      
      setInterimTranscript(interim);
      if (final) {
        setLastVoiceText(rawText); // Save state for undo
        setRawText(prev => prev + (prev ? ' ' : '') + final);
        setInterimTranscript("");
      }
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      if (!permissionAlerted.mic && (event.error === 'not-allowed' || event.error === 'service-not-allowed')) {
        alert("Không thể truy cập Microphone. Vui lòng kiểm tra quyền truy cập trong cài đặt trình duyệt.");
        setPermissionAlerted(prev => ({ ...prev, mic: true }));
      }
      setIsRecording(false);
    };

    recognitionRef.current.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const openCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Trình duyệt không hỗ trợ truy cập camera.");
      }

      // Try environment camera first (back camera on mobile)
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
      } catch (e) {
        console.warn("Environment camera not found, trying default camera...");
        // Fallback to any available camera (usually front camera on laptop)
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (fallbackErr) {
          console.error("Fallback camera access failed", fallbackErr);
          throw fallbackErr;
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraOpen(true);
      }
    } catch (err: any) {
      console.error("Error accessing camera", err);
      let errorMsg = "Không thể truy cập camera.";
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = "Không tìm thấy thiết bị camera.";
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = "Quyền truy cập camera bị từ chối.";
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = "Camera đang được sử dụng bởi ứng dụng khác.";
      }
      
      setCameraError(errorMsg);
      
      if (!permissionAlerted.camera) {
        // We'll show it in UI now, but keep a fallback console log
        setPermissionAlerted(prev => ({ ...prev, camera: true }));
      }
    }
  };

  const closeCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg');
        setPendingImage(imageData);
        
        // Analyze image to get product name
        setIsAnalyzingImage(true);
        try {
          const name = await analyzeImageForName(imageData);
          if (name) {
            setProductName(name);
          }
        } catch (err) {
          console.error("Error analyzing image", err);
        } finally {
          setIsAnalyzingImage(false);
          closeCamera();
          setAdvancedMode(null);
        }
      }
    }
  };

  const [pendingImage, setPendingImage] = useState<string | null>(null);

  const processImage = async (imgUrl: string, taskId: string) => {
    setImageLoading(true);
    const task = tasks.find(t => t.id === taskId);
    if (!canvasRef.current) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, processedImage: imgUrl } : t));
      setImageLoading(false);
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setImageLoading(false);
      return;
    }

    const mainImg = new Image();
    mainImg.crossOrigin = "anonymous";
    
    // Try to load directly, if fails try with proxy for CORS
    const tryLoadImage = (url: string, useProxy = false): Promise<void> => {
      return new Promise((resolve, reject) => {
        const isDataUrl = url.startsWith("data:");
        const timeout = setTimeout(() => reject(new Error("Timeout")), 10000);
        
        mainImg.onload = () => {
          clearTimeout(timeout);
          resolve();
        };
        mainImg.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Load failed"));
        };

        if (isDataUrl) {
          mainImg.src = url;
        } else {
          mainImg.src = useProxy ? `https://images.weserv.nl/?url=${encodeURIComponent(url)}&default=error` : url;
        }
      });
    };

    try {
      const isDataUrl = imgUrl.startsWith("data:");
      try {
        await tryLoadImage(imgUrl);
      } catch (e) {
        if (!isDataUrl) {
          console.warn("Direct load failed, trying proxy...");
          await tryLoadImage(imgUrl, true);
        } else {
          throw e;
        }
      }

      // Make canvas square to match requested 211.67x211.67mm export
      const size = Math.max(mainImg.width, mainImg.height);
      canvas.width = size;
      canvas.height = size;
      
      // Fill background (white for light mode, dark for dark mode or just white for print)
      ctx.fillStyle = "white"; 
      ctx.fillRect(0, 0, size, size);
      
      // Draw main image centered
      const dx = (size - mainImg.width) / 2;
      const dy = (size - mainImg.height) / 2;
      ctx.drawImage(mainImg, dx, dy);

      if (logo) {
        const logoImg = new Image();
        logoImg.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          logoImg.onload = resolve;
          logoImg.onerror = reject;
          logoImg.src = logo.startsWith("data:") ? logo : `https://images.weserv.nl/?url=${encodeURIComponent(logo)}&default=error`;
          setTimeout(() => reject(new Error("Logo timeout")), 5000);
        }).catch(() => console.warn("Logo failed to load"));

        if (logoImg.complete && logoImg.naturalWidth > 0) {
          const padding = canvas.width * 0.02;
          const logoWidth = canvas.width * (28.22 / 211.67);
          const logoHeight = logoWidth;
          
          ctx.globalAlpha = 0.9;
          ctx.drawImage(logoImg, canvas.width - logoWidth - padding, padding, logoWidth, logoHeight);
          ctx.globalAlpha = 1.0;
        }
      }

      const processedUrl = canvas.toDataURL("image/jpeg", 0.9);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, processedImage: processedUrl, processedLogo: logo } : t));
    } catch (err) {
      console.error("Image processing error for task", taskId, err);
      // Try next image if available
      if (task?.content?.imageUrls) {
        const currentIndex = task.content.imageUrls.indexOf(imgUrl);
        if (currentIndex !== -1 && currentIndex < task.content.imageUrls.length - 1) {
          const nextUrl = task.content.imageUrls[currentIndex + 1];
          setTasks(prev => prev.map(t => t.id === taskId ? { ...t, selectedImage: nextUrl } : t));
        }
      }
    } finally {
      setImageLoading(false);
    }
  };

  useEffect(() => {
    // Automatic image processing removed as requested
  }, [tasks.map(t => t.selectedImage).join(','), logo]);

  const undoVoice = () => {
    setRawText(lastVoiceText);
  };

  const cancelVoice = () => {
    stopRecording();
    setRawText("");
    setInterimTranscript("");
    setAdvancedMode(null);
  };

  const removeLogo = () => {
    setLogo(null);
  };

  const removeProductImage = () => {
    if (activeTaskId) {
      setTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, selectedImage: null, processedImage: null, processedLogo: null } : t));
    } else {
      setPendingImage(null);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    const cleanText = text
      .replace(/#{1,6}\s?/g, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/^[*-]\s?/gm, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .trim();

    navigator.clipboard.writeText(cleanText);
    setCopyStatus({ ...copyStatus, [key]: true });
    setTimeout(() => {
      setCopyStatus({ ...copyStatus, [key]: false });
    }, 2000);
  };

  const copyFormatted = async (text: string, key: string) => {
    try {
      // Convert markdown to simple HTML for formatted copy
      // Using p with margin:0 to avoid extra spacing in some apps
      const html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .split('\n')
        .map(line => {
          const trimmed = line.trim();
          if (!trimmed) return '<p style="margin:0"><br></p>';
          if (trimmed.startsWith('<h')) return trimmed;
          return `<p style="margin:0">${trimmed}</p>`;
        })
        .join('');

      const blob = new Blob([html], { type: 'text/html' });
      const plainText = text
        .replace(/#{1,6}\s?/g, '')
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .trim();
      const data = [
        new ClipboardItem({
          'text/html': blob,
          'text/plain': new Blob([plainText], { type: 'text/plain' })
        })
      ];
      
      await navigator.clipboard.write(data);
      
      setCopyStatus({ ...copyStatus, [`${key}_fmt`]: true });
      setTimeout(() => {
        setCopyStatus({ ...copyStatus, [`${key}_fmt`]: false });
      }, 2000);
    } catch (err) {
      console.error('Failed to copy formatted text:', err);
      // Fallback to plain text
      copyToClipboard(text, key);
    }
  };

  const getThemeHex = () => {
    switch (themeColor) {
      case "indigo": return "4F46E5";
      case "emerald": return "059669";
      case "rose": return "E11D48";
      default: return "2563EB";
    }
  };

  const parseMarkdownLine = (text: string) => {
    const parts = [];
    let currentText = text;
    
    // Simple bold parsing **text**
    const boldRegex = /\*\*(.*?)\*\*/g;
    let lastIndex = 0;
    let match;
    
    while ((match = boldRegex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(new TextRun({ text: text.substring(lastIndex, match.index) }));
      }
      // Add bold text
      parts.push(new TextRun({ text: match[1], bold: true }));
      lastIndex = boldRegex.lastIndex;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(new TextRun({ text: text.substring(lastIndex) }));
    }
    
    return parts.length > 0 ? parts : [new TextRun({ text })];
  };

  const getProcessedImageDataUrl = async (imgUrl: string): Promise<string> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return imgUrl;

    const mainImg = new Image();
    mainImg.crossOrigin = "anonymous";
    
    try {
      await new Promise((resolve, reject) => {
        mainImg.onload = resolve;
        mainImg.onerror = reject;
        mainImg.src = imgUrl;
        setTimeout(() => reject(new Error("Main image timeout")), 10000);
      });

      const size = Math.max(mainImg.width, mainImg.height);
      canvas.width = size;
      canvas.height = size;
      
      ctx.fillStyle = "white"; 
      ctx.fillRect(0, 0, size, size);
      
      const dx = (size - mainImg.width) / 2;
      const dy = (size - mainImg.height) / 2;
      ctx.drawImage(mainImg, dx, dy);

      if (logo) {
        const logoImg = new Image();
        logoImg.crossOrigin = "anonymous";
        try {
          await new Promise((resolve, reject) => {
            logoImg.onload = resolve;
            logoImg.onerror = reject;
            logoImg.src = logo;
            setTimeout(() => reject(new Error("Logo timeout")), 5000);
          });

          if (logoImg.complete && logoImg.naturalWidth > 0) {
            const padding = canvas.width * 0.02;
            const logoWidth = canvas.width * (28.22 / 211.67);
            const logoHeight = logoWidth;
            
            ctx.globalAlpha = 0.9;
            ctx.drawImage(logoImg, canvas.width - logoWidth - padding, padding, logoWidth, logoHeight);
            ctx.globalAlpha = 1.0;
          }
        } catch (e) {
          console.warn("Logo failed to load:", e);
        }
      }

      return canvas.toDataURL("image/jpeg", 0.9);
    } catch (err) {
      console.error("Error processing image:", err);
      return imgUrl;
    }
  };

  const exportToWord = async () => {
    if (!activeTask?.content || !activeTask?.productName) return;
    setExporting(true);
    try {
      const sections = [];

      // Add Title
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: activeTask.productName.toUpperCase(),
              bold: true,
              size: 32,
              color: getThemeHex(),
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        })
      );

      // Add Image if available
      const imageToExport = activeTask.selectedImage || pendingImage;
      if (imageToExport) {
        try {
          const processedUrl = await getProcessedImageDataUrl(imageToExport);
          const response = await fetch(processedUrl);
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          
          sections.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: arrayBuffer,
                  transformation: {
                    width: 600, // Adjusted for Word page width
                    height: 600,
                  },
                } as any),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            })
          );
        } catch (imgError) {
          console.error("Error adding image to Word:", imgError);
        }
      }

      // ... rest of Word export logic using activeTask.content
      const descLines = activeTask.content.seoDescription.split('\n');
      // ... (update all content references to activeTask.content)
      descLines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          // Add empty line for spacing
          sections.push(new Paragraph({ spacing: { after: 100 } }));
          return;
        }

        // Check for headings
        const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: headingMatch[2],
                  bold: true,
                  size: level === 1 ? 32 : level === 2 ? 28 : 24,
                }),
              ],
              spacing: { before: 200, after: 100 },
            })
          );
        } else {
          sections.push(
            new Paragraph({
              children: parseMarkdownLine(line),
              spacing: { after: 80 },
            })
          );
        }
      });

      // Add Technical Specs
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "THÔNG SỐ KỸ THUẬT",
              bold: true,
              size: 28,
              color: "1E293B",
            }),
          ],
          spacing: { before: 600, after: 200 },
          border: { bottom: { color: "E2E8F0", space: 1, style: "single", size: 6 } }
        })
      );

      const specLines = activeTask.content.technicalSpecs.split('\n');
      specLines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine) return;

        const cleanLine = trimmedLine.replace(/^[*-]\s?/, '').trim();
        if (cleanLine) {
          sections.push(
            new Paragraph({
              children: parseMarkdownLine(cleanLine),
              spacing: { after: 40 },
            })
          );
        }
      });

      const doc = new Document({
        sections: [{
          properties: {},
          children: sections,
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `${activeTask.productName.replace(/[/\\?%*:|"<>]/g, '-')}.docx`);
    } catch (error) {
      console.error("Error exporting to Word:", error);
    } finally {
      setExporting(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const url = event.target?.result as string;
            if (activeTaskId) {
              setTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, selectedImage: url, processedImage: null } : t));
            } else {
              setPendingImage(url);
            }
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  // Helper function to convert dataURL to File object for server upload
  const convertDataURLToFile = (dataurl: string, filename: string) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1];
    if (!mime) return null;
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        if (activeTaskId) {
          setTasks(prev => prev.map(t => t.id === activeTaskId ? { ...t, selectedImage: url, processedImage: null } : t));
        } else {
          setPendingImage(url);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const compressImage = async (dataUrl: string): Promise<Blob> => {
    const response = await fetch(dataUrl);
    let blob = await response.blob();
    
    // If already under 2MB, return as is
    if (blob.size < 2 * 1024 * 1024) return blob;

    // Otherwise, compress using canvas
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(blob);
          return;
        }
        ctx.drawImage(img, 0, 0);
        
        // Try to compress as JPEG with decreasing quality
        let quality = 0.9;
        const tryCompress = () => {
          canvas.toBlob((newBlob) => {
            if (newBlob && (newBlob.size < 2 * 1024 * 1024 || quality < 0.1)) {
              resolve(newBlob || blob);
            } else {
              quality -= 0.1;
              tryCompress();
            }
          }, 'image/jpeg', quality);
        };
        tryCompress();
      };
      img.src = dataUrl;
    });
  };

  const downloadImage = async () => {
    const imageToDownload = activeTask?.selectedImage || pendingImage;
    if (!imageToDownload) return;
    const fileName = `${activeTask?.productName.replace(/[/\\?%*:|"<>]/g, "-") || "product"}-product.jpg`;

    const processedDataUrl = await getProcessedImageDataUrl(imageToDownload);
    const compressedBlob = await compressImage(processedDataUrl);

    // Try to use File System Access API for "Save As" dialog
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'JPEG Image',
            accept: { 'image/jpeg': ['.jpg'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(compressedBlob);
        await writable.close();
        return;
      } catch (err) {
        // If user cancelled, just return
        if ((err as Error).name === 'AbortError') return;
        console.warn("File System Access API failed, falling back to traditional download:", err);
      }
    }

    // Fallback to traditional download
    const url = URL.createObjectURL(compressedBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const saveAll = async () => {
    if (!activeTask?.content || !activeTask?.processedImage) return;
    
    try {
      // 1. Save Image
      const imageFileName = `${activeTask.productName.replace(/[/\\?%*:|"<>]/g, "-") || "product"}-product.jpg`;
      const compressedBlob = await compressImage(activeTask.processedImage);
      saveAs(compressedBlob, imageFileName);

      // 2. Save TXT with a slight delay to ensure browser handles both downloads
      setTimeout(() => {
        const txtFileName = `${activeTask.productName.replace(/[/\\?%*:|"<>]/g, "-") || "product"}-info.txt`;
        const txtContent = `TÊN SẢN PHẨM: ${activeTask.productName}\n\n` +
          `MÔ TẢ SẢN PHẨM:\n${activeTask.content!.seoDescription.replace(/[#*]/g, '').trim()}\n\n` +
          `THÔNG SỐ KỸ THUẬT:\n${activeTask.content!.technicalSpecs.replace(/^[*-]\s?/gm, '').replace(/[#*]/g, '').trim()}`;
        
        const txtBlob = new Blob([txtContent], { type: "text/plain;charset=utf-8" });
        saveAs(txtBlob, txtFileName);
      }, 500);
    } catch (error) {
      console.error("Error saving all files:", error);
    }
  };

  return (
    <div className={cn(
      "min-h-screen transition-all duration-500 bg-mesh",
      isDarkMode ? "dark" : "",
      fontSize === "small" ? "text-[13px]" : fontSize === "large" ? "text-[15px]" : "text-[14px]"
    )}>
      {/* Progress Bar */}
      <AnimatePresence>
        {tasks.some(t => t.status === 'loading') && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-16 left-0 right-0 h-1 z-[60] origin-left"
            style={{ backgroundColor: themes[themeColor].primary.split(' ')[0].replace('bg-', '') }}
          >
            <motion.div 
              className={cn("h-full", themes[themeColor].primary)}
              style={{ width: `${Math.max(...tasks.filter(t => t.status === 'loading').map(t => t.progress), 0)}%` }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className={cn(
        "border-b sticky top-0 z-50 transition-all duration-300",
        isDarkMode ? "bg-[#1E293B]/80 border-slate-800 backdrop-blur-md" : "bg-white/80 border-slate-200 backdrop-blur-md shadow-sm"
      )}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shadow-lg overflow-hidden transition-transform hover:scale-105",
              themes[themeColor].shadow,
              themes[themeColor].primary
            )}>
              <img 
                src="https://api.dicebear.com/7.x/initials/svg?seed=DL&backgroundColor=0066FF" 
                alt="Duy Linh Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className={cn(
                "font-black text-lg tracking-tight transition-colors",
                isDarkMode ? "text-white" : "text-slate-900"
              )}>Trợ Lý Sản Phẩm Web Duy Linh</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">AI Content Generator</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all border shadow-sm",
                isDarkMode 
                  ? "bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700" 
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              )}
              title={isDarkMode ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối"}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Input & Controls */}
          <div className="lg:col-span-5 space-y-4">
            <section className={cn(
              "rounded-[24px] border transition-all duration-300 overflow-hidden shadow-xl",
              isDarkMode ? "bg-[#1E293B] border-slate-800 shadow-slate-950/50" : "bg-white border-slate-200 shadow-slate-200/50"
            )}>
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center shadow-lg",
                      themes[themeColor].primary,
                      themes[themeColor].shadow
                    )}>
                      <Package className="text-white w-4 h-4" />
                    </div>
                    <h2 className={cn(
                      "font-black text-base uppercase tracking-tight",
                      isDarkMode ? "text-white" : "text-slate-900"
                    )}>Thông tin sản phẩm</h2>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Copilot Style Input Bar */}
                  <div className={cn(
                    "relative rounded-[28px] border-2 transition-all p-2 group",
                    isDarkMode 
                      ? "bg-slate-900/80 border-slate-800 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/10" 
                      : "bg-slate-50/50 border-slate-100 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10",
                    themes[themeColor].ring,
                    themes[themeColor].border
                  )}>
                    <textarea
                      placeholder="Nhập tên sản phẩm hoặc mô tả..."
                      className={cn(
                        "w-full bg-transparent border-none outline-none p-3 text-sm font-bold resize-none min-h-[80px] max-h-[200px]",
                        isDarkMode ? "text-white placeholder:text-slate-600" : "text-slate-800 placeholder:text-slate-400"
                      )}
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onFocus={() => setFocused(true)}
                      onBlur={() => setTimeout(() => setFocused(false), 200)}
                    />

                    <div className="flex items-center justify-between mt-2 px-2 pb-1">
                      <div className="flex items-center gap-2">
                        {/* New Task (+) */}
                        <button 
                          onClick={handleNewTask}
                          className={cn(
                            "w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm",
                            isDarkMode ? "bg-slate-800 text-slate-400 hover:text-white" : "bg-white text-slate-500 hover:text-blue-600 border border-slate-200"
                          )}
                          title="Tạo tab mới"
                        >
                          <Plus className="w-5 h-5" />
                        </button>

                        {/* Mode Selector Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => setShowModeMenu(!showModeMenu)}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border",
                              isDarkMode 
                                ? "bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600" 
                                : "bg-white border-slate-200 text-slate-600 hover:border-blue-200"
                            )}
                          >
                            {processingMode === "Chính xác" && <Check className="w-3 h-3 text-emerald-500" />}
                            {processingMode === "Tốc độ" && <Sparkles className="w-3 h-3 text-amber-500" />}
                            {processingMode === "Chuyên nghiệp" && <BadgeCheck className="w-3 h-3 text-blue-500" />}
                            <span>{processingMode}</span>
                            <ChevronDown className={cn("w-3 h-3 transition-transform", showModeMenu && "rotate-180")} />
                          </button>

                          <AnimatePresence>
                            {showModeMenu && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowModeMenu(false)} />
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                  className={cn(
                                    "absolute bottom-full left-0 mb-2 w-48 rounded-2xl shadow-2xl border overflow-hidden z-50",
                                    isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"
                                  )}
                                >
                                  {(["Chính xác", "Tốc độ", "Chuyên nghiệp"] as ProcessingMode[]).map((mode) => (
                                    <button
                                      key={mode}
                                      onClick={() => {
                                        setProcessingMode(mode);
                                        setShowModeMenu(false);
                                      }}
                                      className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors",
                                        processingMode === mode 
                                          ? (isDarkMode ? "bg-indigo-500/10 text-indigo-400" : "bg-blue-50 text-blue-600")
                                          : (isDarkMode ? "text-slate-400 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900")
                                      )}
                                    >
                                      {mode === "Chính xác" && <Check className="w-3 h-3" />}
                                      {mode === "Tốc độ" && <Sparkles className="w-3 h-3" />}
                                      {mode === "Chuyên nghiệp" && <BadgeCheck className="w-3 h-3" />}
                                      {mode}
                                    </button>
                                  ))}
                                </motion.div>
                              </>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Camera Trigger */}
                        <button
                          onClick={() => {
                            if (advancedMode === 'camera') {
                              closeCamera();
                              setAdvancedMode(null);
                            } else {
                              setAdvancedMode('camera');
                              openCamera();
                              setShowAdvanced(true);
                            }
                          }}
                          className={cn(
                            "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                            advancedMode === 'camera'
                              ? cn(themes[themeColor].primary, "text-white shadow-lg")
                              : (isDarkMode ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-blue-600 hover:bg-blue-50")
                          )}
                          title="Chụp ảnh sản phẩm"
                        >
                          <Camera className="w-5 h-5" />
                        </button>

                        {/* Voice Input Trigger */}
                        <button
                          onClick={() => {
                            if (advancedMode === 'voice') {
                              stopRecording();
                              setAdvancedMode(null);
                            } else {
                              setAdvancedMode('voice');
                              startRecording();
                              setShowAdvanced(true);
                            }
                          }}
                          className={cn(
                            "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                            advancedMode === 'voice'
                              ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                              : (isDarkMode ? "text-slate-400 hover:text-white hover:bg-slate-800" : "text-slate-500 hover:text-blue-600 hover:bg-blue-50")
                          )}
                          title="Ghi âm giọng nói"
                        >
                          <Mic className={cn("w-5 h-5", advancedMode === 'voice' && "animate-pulse")} />
                        </button>

                        {/* Generate Button (Send Icon) */}
                        <button
                          onClick={handleGenerate}
                          disabled={!productName.trim()}
                          className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-90 disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed",
                            themes[themeColor].primary,
                            themes[themeColor].shadow
                          )}
                          title="Tạo nội dung AI"
                        >
                          <Sparkles className="w-5 h-5 text-white" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Suggestions */}
                  <AnimatePresence>
                    {(productName.length > 0 || focused) && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex flex-wrap gap-2 pt-1"
                      >
                        {(productName.length === 0 
                          ? suggestions.slice(0, 6) 
                          : suggestions.filter(s => s.toLowerCase().includes(productName.toLowerCase()))
                        ).map((s) => (
                          <button
                            key={s}
                            onClick={() => setProductName(s)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border",
                              isDarkMode 
                                ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600" 
                                : "bg-slate-50 border-slate-100 text-slate-500 hover:text-blue-600 hover:border-blue-200"
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div>
                    <AnimatePresence>
                      {showAdvanced && (
                        <motion.div
                          initial={{ height: 0, opacity: 0, marginTop: 0 }}
                          animate={{ height: "auto", opacity: 1, marginTop: 12 }}
                          exit={{ height: 0, opacity: 0, marginTop: 0 }}
                          className="overflow-hidden space-y-4"
                        >
                          <div className="flex items-center justify-between px-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tính năng nâng cao</span>
                            <div className="flex gap-2">
                              {/* Quick Mode Switchers inside Advanced */}
                              <button
                                onClick={() => setAdvancedMode(advancedMode === 'text' ? null : 'text')}
                                className={cn(
                                  "p-2 rounded-lg transition-all",
                                  advancedMode === 'text' ? themes[themeColor].accent + " bg-blue-50 dark:bg-blue-900/20" : "text-slate-400 hover:text-slate-600"
                                )}
                              >
                                <Type className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (advancedMode === 'camera') {
                                    closeCamera();
                                    setAdvancedMode(null);
                                  } else {
                                    setAdvancedMode('camera');
                                    openCamera();
                                  }
                                }}
                                className={cn(
                                  "p-2 rounded-lg transition-all",
                                  advancedMode === 'camera' ? themes[themeColor].accent + " bg-blue-50 dark:bg-blue-900/20" : "text-slate-400 hover:text-slate-600"
                                )}
                              >
                                <Camera className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Mode Specific GUI */}
                          <AnimatePresence mode="wait">
                            {advancedMode === 'text' && (
                              <motion.div
                                key="text-mode"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                              >
                                <textarea
                                  placeholder="Dán thông số kỹ thuật thô vào đây..."
                                  className={cn(
                                    "w-full h-32 p-4 rounded-2xl text-xs font-medium transition-all outline-none resize-none border-2",
                                    isDarkMode 
                                      ? "bg-slate-900 border-slate-800 text-slate-300 focus:border-indigo-500" 
                                      : "bg-slate-50 border-slate-100 text-slate-700 focus:border-blue-500 focus:bg-white"
                                  )}
                                  value={rawText}
                                  onChange={(e) => setRawText(e.target.value)}
                                />
                              </motion.div>
                            )}

                            {advancedMode === 'voice' && (
                              <motion.div
                                key="voice-mode"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className={cn(
                                  "p-6 rounded-2xl border-2 border-dashed flex flex-col items-center gap-4 relative overflow-hidden",
                                  isDarkMode ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"
                                )}
                              >
                                {/* Background Sound Wave Effect */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                                  <div className="flex items-center gap-1 h-32">
                                    {[...Array(20)].map((_, i) => (
                                      <motion.div
                                        key={i}
                                        animate={{ height: [20, 80, 20] }}
                                        transition={{ 
                                          repeat: Infinity, 
                                          duration: 0.5 + Math.random() * 0.5,
                                          delay: i * 0.05 
                                        }}
                                        className="w-1.5 bg-red-500 rounded-full"
                                      />
                                    ))}
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 z-10">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Đang lắng nghe...</span>
                                </div>
                                <div className="w-full min-h-[80px] text-center z-10">
                                  <p className={cn("text-xs font-medium leading-relaxed", isDarkMode ? "text-slate-300" : "text-slate-600")}>
                                    {rawText || <span className="opacity-40 italic">Nói gì đó để nhập nội dung...</span>}
                                  </p>
                                  {interimTranscript && (
                                    <p className="text-xs font-bold text-red-400 mt-2 animate-pulse">
                                      {interimTranscript}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-6 z-10">
                                  <button
                                    onClick={undoVoice}
                                    disabled={!lastVoiceText && !rawText}
                                    className="w-10 h-10 flex items-center justify-center bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full transition-all disabled:opacity-30 hover:bg-blue-100 hover:text-blue-600"
                                    title="Hoàn tác"
                                  >
                                    <History className="w-5 h-5" />
                                  </button>
                                  <button
                                    onClick={() => { stopRecording(); setAdvancedMode(null); }}
                                    className="w-14 h-14 flex items-center justify-center bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all scale-110"
                                    title="Xong"
                                  >
                                    <Mic className="w-6 h-6" />
                                  </button>
                                  <button
                                    onClick={cancelVoice}
                                    className="w-10 h-10 flex items-center justify-center bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full transition-all hover:bg-red-100 hover:text-red-500"
                                    title="Huỷ"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>
                              </motion.div>
                            )}

                            {advancedMode === 'camera' && (
                              <motion.div
                                key="camera-mode"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="space-y-3"
                              >
                                <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border-2 border-slate-800 shadow-2xl flex items-center justify-center">
                                  {cameraError ? (
                                    <div className="text-center p-6 space-y-3">
                                      <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                                        <AlertCircle className="w-6 h-6 text-red-500" />
                                      </div>
                                      <p className="text-sm font-bold text-white">{cameraError}</p>
                                      <button 
                                        onClick={openCamera}
                                        className="text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors"
                                      >
                                        Thử lại
                                      </button>
                                    </div>
                                  ) : (
                                    <video 
                                      ref={videoRef} 
                                      autoPlay 
                                      playsInline 
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                  {isAnalyzingImage && (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                                      <span className="text-white text-[10px] font-black uppercase tracking-widest">Đang nhận diện sản phẩm...</span>
                                    </div>
                                  )}
                                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                                    <button
                                      onClick={capturePhoto}
                                      disabled={isAnalyzingImage}
                                      className="px-6 py-3 bg-white text-slate-900 rounded-full font-bold text-[10px] uppercase tracking-wider shadow-lg hover:bg-slate-100 transition-all flex items-center gap-2"
                                    >
                                      <Camera className="w-4 h-4" />
                                      Chụp & Nhận diện
                                    </button>
                                    <button
                                      onClick={() => { closeCamera(); setAdvancedMode(null); }}
                                      className="px-6 py-3 bg-red-500 text-white rounded-full font-bold text-[10px] uppercase tracking-wider shadow-lg hover:bg-red-600 transition-all"
                                    >
                                      Huỷ
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {pendingImage && !advancedMode && (
                            <div className="flex items-center gap-4 p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
                              <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-blue-500 shadow-md group">
                                <img src={pendingImage} className="w-full h-full object-cover" />
                                <button 
                                  onClick={() => setPendingImage(null)}
                                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                              <div className="flex-grow">
                                <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1">Ảnh đã chụp</p>
                                <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Sẽ được sử dụng làm ảnh gốc cho sản phẩm.</p>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </section>

            {/* Task List Section */}
            {tasks.length > 0 && (
              <section className={cn(
                "rounded-[24px] border transition-all duration-300 overflow-hidden shadow-lg",
                isDarkMode ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200"
              )}>
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h3 className={cn(
                    "font-black text-[10px] uppercase tracking-widest",
                    isDarkMode ? "text-slate-400" : "text-slate-500"
                  )}>Danh sách xử lý</h3>
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 text-[9px] font-bold">{tasks.length}</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                  {tasks.map(task => (
                    <div 
                      key={task.id}
                      onClick={() => setActiveTaskId(task.id)}
                      className={cn(
                        "w-full p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between group",
                        activeTaskId === task.id 
                          ? (isDarkMode ? "bg-slate-800" : "bg-blue-50")
                          : (isDarkMode ? "hover:bg-slate-800/50" : "hover:bg-slate-50")
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                          task.status === 'loading' ? "bg-blue-100 text-blue-600" : 
                          task.status === 'paused' ? "bg-amber-100 text-amber-600" :
                          task.status === 'error' ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                        )}>
                          {task.status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                           task.status === 'paused' ? <StopCircle className="w-4 h-4" /> :
                           task.status === 'error' ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className={cn(
                            "text-[11px] font-bold truncate",
                            isDarkMode ? "text-slate-200" : "text-slate-900"
                          )}>{task.productName}</p>
                          <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">
                            {task.status === 'loading' ? `Đang tạo... ${Math.round(task.progress)}%` : 
                             task.status === 'paused' ? "Đã tạm dừng" :
                             task.status === 'error' ? "Lỗi xử lý" : "Hoàn thành"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {task.status !== 'completed' && task.status !== 'error' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handlePause(task.id); }}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-all opacity-0 group-hover:opacity-100"
                            title={task.status === 'paused' ? "Tiếp tục" : "Tạm dừng"}
                          >
                            {task.status === 'paused' ? <Sparkles className="w-3 h-3" /> : <StopCircle className="w-3 h-3" />}
                          </button>
                        )}
                        {(task.status === 'loading' || task.status === 'paused') && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleCancel(task.id); }}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                            title="Huỷ bỏ"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Image Section in Left Column */}
            <section className={cn(
              "rounded-[24px] border transition-all duration-300 overflow-hidden shadow-lg",
              isDarkMode ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200"
            )}>
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className={cn(
                    "font-black text-xs uppercase tracking-widest",
                    themes[themeColor].accent
                  )}>Hình ảnh & Logo</h3>
                  
                  <div className="flex items-center gap-2">
                    {/* Internet Search Button */}
                    <button
                      onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(productName)}&tbm=isch`, '_blank')}
                      disabled={!productName.trim()}
                      className={cn(
                        "h-8 px-3 rounded-lg flex items-center gap-2 transition-all border shadow-sm font-bold text-[10px] uppercase tracking-wider",
                        isDarkMode 
                          ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-white" 
                          : "bg-white border-slate-200 text-slate-500 hover:text-blue-600"
                      )}
                      title="Tìm ảnh Internet"
                    >
                      <Globe className="w-4 h-4" />
                      <span className="hidden sm:inline">Tìm ảnh</span>
                    </button>

                    {/* Logo Control */}
                    <button
                      onClick={(e) => { e.stopPropagation(); logo ? removeLogo() : logoInputRef.current?.click(); }}
                      className={cn(
                        "h-8 px-3 rounded-lg flex items-center gap-2 transition-all border shadow-sm group font-bold text-[10px] uppercase tracking-wider",
                        logo 
                          ? "bg-blue-500 border-blue-400 text-white hover:bg-blue-600" 
                          : (isDarkMode ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-white" : "bg-white border-slate-200 text-slate-500 hover:text-blue-600")
                      )}
                      title={logo ? "Xoá Logo" : "Chèn Logo"}
                    >
                      <BadgeCheck className="w-4 h-4" />
                      <span>{logo ? "Xoá Logo" : "Chèn Logo"}</span>
                    </button>
                  </div>

                  {/* Hidden inputs */}
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleProductImageUpload} />
                  <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                </div>

                <div 
                  className={cn(
                    "relative aspect-square rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden group transition-all outline-none",
                    isDarkMode ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-100",
                    "hover:border-blue-500 focus:border-blue-500 cursor-pointer"
                  )}
                  onPaste={handlePaste}
                  onClick={() => fileInputRef.current?.click()}
                  tabIndex={0}
                >
                  {(activeTask?.selectedImage || pendingImage) ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <img
                        src={activeTask?.selectedImage || pendingImage || ""}
                        alt="Product"
                        className="w-full h-full object-contain p-4"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      
                      {/* Logo Overlay Preview */}
                      {((activeTask?.selectedImage || pendingImage) && logo) && (
                        <div className="absolute top-8 right-8 w-16 h-16 opacity-80 pointer-events-none">
                          <img src={logo} className="w-full h-full object-contain" />
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadImage(); }}
                          className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-slate-900 hover:scale-110 transition-transform shadow-xl"
                          title="Tải ảnh xuống"
                        >
                          <Download className="w-6 h-6" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeProductImage(); }}
                          className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform shadow-xl"
                          title="Xoá ảnh"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-6 flex flex-col items-center gap-4">
                      <ImageIcon className="w-10 h-10 text-slate-300 mx-auto" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nhấn vào để chọn ảnh hoặc Ctrl - V để dán ảnh</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* SEO Section - Appears below Image Section when content exists */}
            <AnimatePresence>
              {activeTask?.content && (
                <motion.section
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className={cn(
                    "rounded-[24px] border transition-all duration-300 overflow-hidden shadow-lg",
                    isDarkMode ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200"
                  )}
                >
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className={cn(
                        "font-black text-xs uppercase tracking-widest",
                        themes[themeColor].accent
                      )}>Tối ưu SEO (Yoast)</h3>
                      <Sparkles className="w-4 h-4 text-amber-500" />
                    </div>

                    <div className="space-y-4">
                      {/* Focus Keyword */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Cụm từ khoá chính</label>
                          <button 
                            onClick={() => copyToClipboard(activeTask.content?.yoastFocusKeyword || "", "focus_kw")}
                            className="text-[10px] font-bold text-blue-500 hover:underline"
                          >
                            {copyStatus["focus_kw"] ? "Đã chép" : "Sao chép"}
                          </button>
                        </div>
                        <div className={cn(
                          "p-3 rounded-xl border font-medium text-sm",
                          isDarkMode ? "bg-slate-900/50 border-slate-800 text-slate-200" : "bg-slate-50 border-slate-100 text-slate-700"
                        )}>
                          {activeTask.content.yoastFocusKeyword}
                        </div>
                      </div>

                      {/* Product Tags */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Thẻ sản phẩm (Tags)</label>
                          <button 
                            onClick={() => copyToClipboard(activeTask.content?.productTags.join(", ") || "", "tags")}
                            className="text-[10px] font-bold text-blue-500 hover:underline"
                          >
                            {copyStatus["tags"] ? "Đã chép" : "Sao chép"}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {activeTask.content.productTags.map((tag, idx) => (
                            <span 
                              key={idx}
                              className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-bold border transition-all",
                                isDarkMode ? "bg-slate-800 border-slate-700 text-slate-300" : "bg-white border-slate-200 text-slate-600"
                              )}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7 space-y-6">
            {activeTask?.status === 'loading' ? (
              <div className="space-y-6">
                {/* Skeleton for Image */}
                <div className={cn(
                  "rounded-[24px] border p-6 space-y-4 animate-pulse",
                  isDarkMode ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                  </div>
                  <div className="aspect-video bg-slate-200 dark:bg-slate-700 rounded-2xl" />
                </div>

                {/* Skeleton for Content */}
                <div className={cn(
                  "rounded-[24px] border p-6 space-y-4 animate-pulse",
                  isDarkMode ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200"
                )}>
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="flex gap-2">
                      <div className="h-8 w-20 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                      <div className="h-8 w-32 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-4 w-[90%] bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-4 w-[95%] bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-4 w-[40%] bg-slate-200 dark:bg-slate-700 rounded mt-6" />
                    <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="h-4 w-[85%] bg-slate-200 dark:bg-slate-700 rounded" />
                  </div>
                </div>
              </div>
            ) : !activeTask?.content ? (
              <div className={cn(
                "h-full min-h-[400px] rounded-[24px] border border-dashed flex flex-col items-center justify-center text-center p-12",
                isDarkMode ? "bg-slate-900/20 border-slate-800" : "bg-slate-50 border-slate-200"
              )}>
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-xl",
                  isDarkMode ? "bg-slate-800" : "bg-white"
                )}>
                  <Search className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className={cn(
                  "text-lg font-black uppercase tracking-tight mb-2",
                  isDarkMode ? "text-slate-400" : "text-slate-500"
                )}>Sẵn sàng tạo nội dung</h3>
                <p className="text-xs text-slate-400 font-medium max-w-xs">
                  Nhập tên sản phẩm và nhấn nút tạo để AI bắt đầu viết bài cho bạn.
                </p>
              </div>
            ) : (
              <AnimatePresence>
                {activeTask.content && (
                  <div className="space-y-6">
                    {/* SEO Description */}
                    <motion.section
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "rounded-[24px] border overflow-hidden shadow-lg",
                        isDarkMode ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200"
                      )}
                    >
                      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex items-center gap-3">
                          <FileText className={cn("w-4 h-4", themes[themeColor].accent)} />
                          <h2 className={cn(
                            "font-black text-xs uppercase tracking-widest",
                            themes[themeColor].accent
                          )}>Mô tả sản phẩm</h2>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyFormatted(activeTask.content!.seoDescription, "seo")}
                            className={cn(
                              "px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2 font-bold text-[9px] uppercase tracking-wider",
                              isDarkMode ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                            )}
                            title="Sao chép giữ nguyên định dạng (Bold, List...)"
                          >
                            {copyStatus["seo_fmt"] ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            {copyStatus["seo_fmt"] ? "Đã chép" : "Sao chép"}
                          </button>
                        </div>
                      </div>
                      <div className={cn(
                        "p-6 text-sm leading-relaxed",
                        isDarkMode ? "text-slate-200" : "text-slate-800"
                      )}>
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                            h2: ({ children }) => <h2 className={cn("text-lg font-black mt-6 mb-3 tracking-tight", isDarkMode ? "text-white" : "text-slate-900")}>{children}</h2>,
                            h3: ({ children }) => <h3 className={cn("text-base font-bold mt-5 mb-2 tracking-tight", isDarkMode ? "text-slate-100" : "text-slate-800")}>{children}</h3>,
                            strong: ({ children }) => <strong className={cn("font-bold", isDarkMode ? "text-white" : "text-slate-900")}>{children}</strong>,
                          }}
                        >
                          {activeTask.content.seoDescription}
                        </ReactMarkdown>
                      </div>
                    </motion.section>

                    {/* Technical Specs */}
                    <motion.section
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className={cn(
                        "rounded-[24px] border overflow-hidden shadow-lg",
                        isDarkMode ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200"
                      )}
                    >
                      <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex items-center gap-3">
                          <Settings className={cn("w-4 h-4", themes[themeColor].accent)} />
                          <h2 className={cn(
                            "font-black text-xs uppercase tracking-widest",
                            themes[themeColor].accent
                          )}>Thông số kỹ thuật</h2>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyToClipboard(activeTask.content!.technicalSpecs, "specs")}
                            className={cn(
                              "px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2 font-bold text-[9px] uppercase tracking-wider",
                              isDarkMode ? "bg-slate-800 border-slate-700 text-slate-400 hover:text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                            )}
                            title="Sao chép văn bản thuần"
                          >
                            {copyStatus["specs"] ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            {copyStatus["specs"] ? "Đã chép" : "Sao chép"}
                          </button>
                        </div>
                      </div>
                      <div className={cn(
                        "p-6 text-sm",
                        isDarkMode ? "text-slate-200" : "text-slate-800"
                      )}>
                        <div className="space-y-1">
                          {activeTask.content.technicalSpecs.split('\n').filter(line => line.trim()).map((line, i) => (
                            <div key={i} className="flex items-start gap-3">
                              <div className="flex-grow leading-relaxed">
                                {line.replace(/^[*-]\s?/, '').trim()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.section>

                    {/* Export Buttons */}
                    <AnimatePresence>
                      {activeTask.content && activeTask.processedImage && logo && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="grid grid-cols-1 md:grid-cols-2 gap-4"
                        >
                          <button
                            onClick={saveAll}
                            className={cn(
                              "h-12 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]",
                              "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
                            )}
                            title="Lưu ảnh và text [Alt + S]"
                          >
                            <Download className="w-4 h-4" />
                            LƯU ẢNH & TXT
                          </button>
                          <button
                            onClick={exportToWord}
                            disabled={exporting}
                            className={cn(
                              "h-12 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] disabled:opacity-50",
                              "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                            )}
                            title="Xuất file Word [Alt + W]"
                          >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {exporting ? "ĐANG XUẤT FILE..." : "XUẤT FILE WORD"}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-12 border-t border-slate-200 dark:border-slate-800 mt-10">
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <button 
            onClick={() => setShowChangelog(true)}
            className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-blue-500 transition-colors"
          >
            Webapp tạo bởi Huan Do | Phiên bản {APP_VERSION}
          </button>
          <p className="text-[9px] font-bold text-slate-500">© 2026 Duy Linh Web Assistant</p>
        </div>
      </footer>

      {/* Help Modal */}
      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHelp(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={cn(
                "relative w-full max-w-lg rounded-[32px] border p-8 shadow-2xl overflow-hidden",
                isDarkMode ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200"
              )}
            >
              <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg", themes[themeColor].primary)}>
                    <HelpCircle className="text-white w-6 h-6" />
                  </div>
                  <div>
                    <h2 className={cn("text-xl font-black uppercase tracking-tight", isDarkMode ? "text-white" : "text-slate-900")}>Hướng dẫn sử dụng</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Làm chủ công cụ AI của bạn</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="pt-2">
                    <div className="space-y-4">
                      {[
                        { title: "Bước 1: Nhập tên", desc: "Nhập tên sản phẩm chính xác để AI có thể tìm đúng thông tin và hình ảnh." },
                        { title: "Bước 2: Tùy chỉnh", desc: "Sử dụng thanh công cụ để tải ảnh riêng, chèn logo thương hiệu hoặc chọn chế độ AI." },
                        { title: "Bước 3: Tạo nội dung", desc: "Nhấn nút Tạo Nội Dung để AI viết mô tả chuẩn SEO và liệt kê thông số kỹ thuật." },
                        { title: "Bước 4: Lưu trữ", desc: "Sao chép từng phần hoặc xuất toàn bộ ra file Word chuyên nghiệp." }
                      ].map((step, i) => (
                        <div key={i} className="flex gap-4">
                          <div className={cn("w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-black", themes[themeColor].secondary)}>
                            {i + 1}
                          </div>
                          <div>
                            <p className={cn("text-sm font-black uppercase tracking-tight", isDarkMode ? "text-slate-200" : "text-slate-800")}>{step.title}</p>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed">{step.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowHelp(false)}
                  className={cn(
                    "w-full h-12 text-white rounded-xl font-bold text-sm transition-all active:scale-[0.98]",
                    themes[themeColor].primary
                  )}
                >
                  ĐÃ HIỂU, BẮT ĐẦU THÔI!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Changelog Modal */}
      <AnimatePresence>
        {showChangelog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowChangelog(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={cn(
                "relative w-full max-w-lg rounded-[32px] border p-8 shadow-2xl overflow-hidden",
                isDarkMode ? "bg-[#1E293B] border-slate-800" : "bg-white border-slate-200"
              )}
            >
              <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-4">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg", themes[themeColor].primary)}>
                    <History className="text-white w-6 h-6" />
                  </div>
                  <div>
                    <h2 className={cn("text-xl font-black uppercase tracking-tight", isDarkMode ? "text-white" : "text-slate-900")}>Nhật ký thay đổi</h2>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Lịch sử cập nhật ứng dụng</p>
                  </div>
                </div>

                <div className={cn(
                  "rounded-2xl border p-6 max-h-[400px] overflow-y-auto space-y-8 custom-scrollbar",
                  isDarkMode ? "bg-slate-900/50 border-slate-800" : "bg-slate-50 border-slate-100"
                )}>
                  {CHANGELOG.slice().reverse().map((entry, idx) => (
                    <div key={idx} className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-800 last:border-transparent pb-8 last:pb-0">
                      <div className={cn(
                        "absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2",
                        isDarkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200",
                        idx === 0 ? "border-blue-500" : "border-slate-400"
                      )} />
                      <div className="flex items-center justify-between mb-2">
                        <span className={cn("text-sm font-black", themes[themeColor].accent)}>v{entry.version}</span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{entry.date}</span>
                      </div>
                      <ul className="space-y-2">
                        {entry.changes.map((change, cIdx) => (
                          <li key={cIdx} className="text-xs text-slate-400 flex items-start gap-2 leading-relaxed">
                            <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-600 flex-shrink-0" />
                            {change}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setShowChangelog(false)}
                  className={cn(
                    "w-full h-12 text-white rounded-xl font-bold text-sm transition-all active:scale-[0.98]",
                    themes[themeColor].primary
                  )}
                >
                  ĐÓNG
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden Canvas */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
