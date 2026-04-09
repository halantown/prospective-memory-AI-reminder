/** Recipe tab — placeholder for press-and-hold recipe viewer. */

export default function RecipeTab() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 text-slate-400">
      <span className="text-3xl mb-3">📖</span>
      <p className="text-xs text-center font-medium mb-1">Recipe Book</p>
      <p className="text-[10px] text-center text-slate-500 leading-relaxed">
        Press and hold to view the current recipe instructions.
      </p>
    </div>
  )
}
