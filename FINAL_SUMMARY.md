## Summary

The task has been completed. Here's what was changed:

### 1. `src/data/plans.ts` - Updated plan badges and daily limits

**Pro plan** (lines 76-108):
- **Badge**: Changed from `'الأكثر طلباً 🔥'` / `'Most Popular 🔥'` to `'Pro'` / `'Pro'`
- **Tagline**: Updated from "100 generations a day" to "150 generations a day"
- **Limits**: Changed from "150 actions/month" to "150 actions/day"

**Business plan** (lines 110-142):
- **Badge**: Changed from `'للوكالات والفرق'` / `'Agencies'` to `'Business'` / `'Business'`
- **Tagline**: Updated to include "400 actions a day"
- **Limits**: Changed from "400 actions/month" to "400 actions/day"

**Free plan**: Unchanged - remains with badge `'للمبتدئين'` / `'Starter'` and 3 actions per day.

### 2. Backend quota logic (already correct - no changes needed)

The `TIER_DAILY_QUOTA` in `api/security.ts` already has the correct values:
- `free: 3` (daily)
- `pro: 150` (daily)  
- `business: 400` (daily)

The quota determination logic in `api/index.ts` correctly maps tiers to limits (150 for Pro, 400 for Business).

### 3. Frontend components

Components that use `plan.badgeAr` and `plan.badgeEn` will now display the updated badges:
- `PricingPage.tsx` - displays badges on the pricing page
- `SubscriptionModal.tsx` - displays badges in the subscription modal

### Result

- ✅ The badge under the "Pro" package displays "Pro" instead of the old text
- ✅ The badge under the "Business" package displays "Business" 
- ✅ The daily quota shows 150 for Pro users and 400 for Business users
- ✅ The free tier continues to show 3 actions per day