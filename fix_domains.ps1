$path = 'C:\Users\Fast\OneDrive\Desktop\ebnily\src\components\CustomDomainCard.tsx'
$s = Get-Content -Raw -Path $path
$s = $s.Replace(' transition" dir="ltr"', '')
$s = $s.Replace(' text-slate-200" dir="ltr"', '')
Set-Content -Path $path -Value $s