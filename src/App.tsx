import { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';
import { Video, Sparkles, Settings2, Loader2, Play, Download, AlertCircle, Key } from 'lucide-react';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const LOADING_MESSAGES = [
  "Initializing video generation...",
  "Warming up the AI models...",
  "Analyzing your prompt...",
  "Setting up the scene...",
  "Rendering frames...",
  "Adding cinematic touches...",
  "Polishing the final video...",
  "Almost there, finalizing output...",
  "This usually takes a few minutes. Hang tight!",
];

export default function App() {
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p');
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  useEffect(() => {
    checkApiKey();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const checkApiKey = async () => {
    if (window.aistudio?.hasSelectedApiKey) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(hasKey);
    } else {
      // If not running in AI Studio environment with this API, assume we have the env var
      setHasApiKey(true);
    }
  };

  const handleSelectKey = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success to avoid race condition as per docs
      setHasApiKey(true);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt.");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setVideoUrl(null);
    setLoadingMessageIndex(0);

    try {
      // Always create a new instance right before making an API call
      const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("API Key is missing. Please select an API key.");
      }

      const ai = new GoogleGenAI({ apiKey });

      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-lite-generate-preview',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: resolution,
          aspectRatio: aspectRatio,
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      if (operation.error) {
        throw new Error((operation.error as any).message || "An error occurred during video generation.");
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      
      if (!downloadLink) {
        throw new Error("No video URL returned from the API.");
      }

      // Fetch the video
      const response = await fetch(downloadLink, {
        method: 'GET',
        headers: {
          'x-goog-api-key': apiKey,
        },
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
            // Might be a key issue or entity not found
            const errorText = await response.text();
            if (errorText.includes("Requested entity was not found")) {
                setHasApiKey(false);
                throw new Error("Requested entity was not found. Please select your API key again.");
            }
        }
        throw new Error(`Failed to fetch video: ${response.statusText}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setVideoUrl(objectUrl);

    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
      }
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (hasApiKey === false) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-[#141414] border border-white/10 rounded-2xl p-8 text-center"
        >
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
            <Key className="w-8 h-8 text-blue-400" />
          </div>
          <h2 className="text-2xl font-semibold mb-4">API Key Required</h2>
          <p className="text-gray-400 mb-8 text-sm leading-relaxed">
            To generate videos using the Veo model, you need to provide your own Google Cloud API Key with billing enabled.
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Key className="w-4 h-4" />
            Select API Key
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-blue-500/30">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Video className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-semibold text-lg tracking-tight">Veo Studio</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Controls */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A cinematic shot of a futuristic city at sunset..."
                className="w-full h-32 bg-black/50 border border-white/10 rounded-xl p-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none transition-all"
                disabled={isGenerating}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                <Settings2 className="w-4 h-4" />
                Settings
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Aspect Ratio</label>
                  <div className="flex bg-black/50 border border-white/10 rounded-lg p-1">
                    {(['16:9', '9:16'] as const).map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        disabled={isGenerating}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                          aspectRatio === ratio 
                            ? 'bg-white/10 text-white shadow-sm' 
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">Resolution</label>
                  <div className="flex bg-black/50 border border-white/10 rounded-lg p-1">
                    {(['720p', '1080p'] as const).map((res) => (
                      <button
                        key={res}
                        onClick={() => setResolution(res)}
                        disabled={isGenerating}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                          resolution === res 
                            ? 'bg-white/10 text-white shadow-sm' 
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full bg-white text-black hover:bg-gray-200 disabled:bg-white/10 disabled:text-white/30 font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Video
                </>
              )}
            </button>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Preview */}
        <div className="lg:col-span-8">
          <div className="bg-[#111] border border-white/10 rounded-2xl overflow-hidden relative flex items-center justify-center min-h-[400px] lg:min-h-[600px]">
            <AnimatePresence mode="wait">
              {isGenerating ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10"
                >
                  <div className="relative w-24 h-24 mb-8">
                    <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-blue-500 rounded-full border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Video className="w-8 h-8 text-blue-500 animate-pulse" />
                    </div>
                  </div>
                  <motion.p
                    key={loadingMessageIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-gray-300 font-medium"
                  >
                    {LOADING_MESSAGES[loadingMessageIndex]}
                  </motion.p>
                  <p className="text-xs text-gray-500 mt-4 max-w-xs text-center">
                    Video generation with Veo takes a few minutes. Please do not close this tab.
                  </p>
                </motion.div>
              ) : videoUrl ? (
                <motion.div
                  key="video"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full h-full flex flex-col"
                >
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-contain bg-black"
                  />
                  <div className="absolute top-4 right-4 flex gap-2">
                    <a
                      href={videoUrl}
                      download="generated-video.mp4"
                      className="bg-black/50 hover:bg-black/80 backdrop-blur-md border border-white/10 text-white p-2 rounded-lg transition-colors"
                      title="Download Video"
                    >
                      <Download className="w-5 h-5" />
                    </a>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center p-8"
                >
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Play className="w-8 h-8 text-white/20 ml-1" />
                  </div>
                  <h3 className="text-xl font-medium text-gray-300 mb-2">No Video Yet</h3>
                  <p className="text-gray-500 max-w-sm mx-auto">
                    Enter a prompt and click generate to create your first AI video using Google's Veo model.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}
