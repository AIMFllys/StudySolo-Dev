export function LandingFooter() {
  return (
    <footer className="relative z-10 px-6 py-12 border-t border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-sm text-slate-500">
        <div className="flex items-center gap-4">
          <span>{new Date().getFullYear()} © StudySolo</span>
          <span className="text-slate-300">|</span>
          <span>华中科技大学首届 AI 智能体大赛参赛项目</span>
        </div>
        <div className="flex gap-8 mt-4 md:mt-0 font-medium">
          <a
            href="https://StudyFlow.1037solo.com/introduce"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-900 transition-colors"
          >
            项目介绍
          </a>
          <a
            href="https://github.com/AIMFllys/StudySolo"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-900 transition-colors"
          >
            开源仓库
          </a>
          <a
            href="https://docs.1037solo.com/#/docs/studysolo-terms"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-900 transition-colors"
          >
            服务条款
          </a>
        </div>
      </div>
    </footer>
  );
}
