import { useState } from 'react';
import type { FormEvent } from 'react';
import { MousePointerClick, Sparkles, X, Palette, Type, Trash2 } from 'lucide-react';
import { SelectedElementInfo, Language } from '../types';

interface VisualInspectorModalProps {
  elementInfo: SelectedElementInfo;
  onClose: () => void;
  onSubmitRefinement: (prompt: string, elementInfo: SelectedElementInfo) => void;
  language: Language;
}

export const VisualInspectorModal = ({
  elementInfo,
  onClose,
  onSubmitRefinement,
  language,
}: VisualInspectorModalProps) => {
  const [promptText, setPromptText] = useState('');

  interface QuickAction {
    titleAr: string;
    titleEn: string;
    prompt: string;
    icon: import('react').ReactNode;
  }

  const quickActions: QuickAction[] = [
    {
      titleAr: 'تغيير اللون للبنفسجي 🟣',
      titleEn: 'Change color to purple',
      prompt: 'Change this element color to purple / violet with high contrast',
      icon: <Palette className="w-3.5 h-3.5" />,
    },
    {
      titleAr: 'تكبير الحجم والخط 🔍',
      titleEn: 'Enlarge size & padding',
      prompt: 'Make this element larger with generous padding and prominent font',
      icon: <Type className="w-3.5 h-3.5" />,
    },
    {
      titleAr: 'إضافة تأثير حركي عند التحويم ✨',
      titleEn: 'Add hover scale effect',
      prompt: 'Add smooth hover transition with shadow and scale effect',
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
    {
      titleAr: 'حذف هذا العنصر 🗑️',
      titleEn: 'Remove element',
      prompt: 'Remove or delete this element completely from the layout',
      icon: <Trash2 className="w-3.5 h-3.5" />,
    },
  ];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!promptText.trim()) return;
    onSubmitRefinement(promptText.trim(), elementInfo);
    onClose();
  };

  const handleQuickAction = (actionPrompt: string) => {
    onSubmitRefinement(actionPrompt, elementInfo);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <MousePointerClick className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">
                {language === 'ar' ? 'التعديل البصري للعنصر' : 'Visual Element Inspector'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {language === 'ar' ? 'قم بتعديل هذا الجزء من الصفحة مباشرة' : 'Modify this targeted element directly with AI'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inspected Element Details */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 font-mono text-xs">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>TAG: &lt;{elementInfo.tagName}&gt;</span>
            <span className="text-rose-400 truncate max-w-[200px]">{elementInfo.selector}</span>
          </div>
          {elementInfo.text && (
            <div className="text-slate-200 truncate bg-slate-900/90 px-2 py-1 rounded text-[11px]">
              "{elementInfo.text}"
            </div>
          )}
        </div>

        {/* Quick Suggestion Buttons */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-slate-400 block">
            {language === 'ar' ? 'تعديلات سريعة مقترحة:' : 'Quick Actions:'}
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {quickActions.map((action, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleQuickAction(action.prompt)}
                className="flex items-center gap-2 p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700/60 text-xs transition text-left cursor-pointer"
              >
                <span className="text-rose-400 shrink-0">{action.icon}</span>
                <span className="truncate">{language === 'ar' ? action.titleAr : action.titleEn}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Prompt Form */}
        <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {language === 'ar' ? 'أو اكتب التعديل المطلوب بالتفصيل:' : 'Or describe your custom modification:'}
            </label>
            <input
              type="text"
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              placeholder={
                language === 'ar'
                  ? 'مثال: اجعل الزر باللون الأخضر مع أيقونة سلة مشتريات'
                  : 'e.g. Change text to "Sign Up Now" and make it full width'
              }
              autoFocus
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 font-medium transition"
            >
              {language === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={!promptText.trim()}
              className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{language === 'ar' ? 'تطبيق التعديل' : 'Apply Change'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
