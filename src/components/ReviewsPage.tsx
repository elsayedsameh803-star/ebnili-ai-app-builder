import { useState } from 'react';
import { Star, Send, User } from 'lucide-react';

export interface Review {
  id: string;
  name: string;
  rating: number;
  comment: string;
  date: string;
}

export default function ReviewsPage({ initialReviews = [], onSubmitReview }: {
  initialReviews?: Review[];
  onSubmitReview?: (name: string, rating: number, comment: string) => void;
}) => {
  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [reviews, setReviews] = useState<Review[]>(initialReviews);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || rating === 0 || !comment.trim()) return;
    const newReview: Review = {
      id: Date.now().toString(),
      name: name.trim(),
      rating,
      comment: comment.trim(),
      date: new Date().toISOString(),
    };
    if (onSubmitReview) {
      await onSubmitReview(name.trim(), rating, comment.trim());
    } else {
      setReviews((prev) => [newReview, ...prev]);
    }
    setRating(0);
    setComment('');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">آراء العملاء</h1>
          <p className="text-slate-400">شاركنا تجربتك مع الموقع واكتب تقييمك</p>
        </div>

        <div className="grid gap-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">أضف تقييمك</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-white">
                    <User className="w-5 h-5" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="اسمك"
                    className="flex-1 bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-rose-500"
                    required
                  />
                </div>

                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 cursor-pointer transition-transform hover:scale-110 ${star <= rating ? 'text-amber-400' : 'text-slate-300'}`}
                      onClick={() => setRating(star)}
                    />
                  ))}
                </div>

                <div className="mt-2">
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    تجربتك مع الموقع
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="اكتب تجربتك مع الموقع هنا..."
                    className="w-full min-h-[120px] px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-rose-500 resize-none"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="mt-4 px-6 py-2 rounded-lg bg-gradient-to-r from-rose-500 to-orange-500 text-white font-bold hover:from-rose-600 hover:to-orange-600 transition shadow-lg"
              >
                <span className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  إرسال التقييم
                </span>
              </button>
            </form>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">آراء العملاء السابقة</h2>

            {submitted && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                تم إرسال التقييم بنجاح! شكراً لوقتك.
              </div>
            )}

            {reviews.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p className="text-slate-400">لا توجد آراء بعد. كن أول من يكتب رأيه!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="bg-slate-700/30 border border-slate-600 rounded-xl p-4 hover:border-slate-500 transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-white">
                          <User className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white">{review.name}</h4>
                          <p className="text-xs text-slate-400">
                            {new Date(review.date).toLocaleDateString('ar-EG', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${star <= review.rating ? 'text-amber-400' : 'text-slate-500'}`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-slate-300">{review.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
