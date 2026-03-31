export function UserDetailLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-8 w-24 bg-[#232323] rounded-lg animate-pulse" />
        <div className="h-6 w-48 bg-[#232323] rounded-lg animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-[120px] bg-[#171717] border border-[#2e2e2e] rounded-md animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="h-64 bg-[#171717] border border-[#2e2e2e] rounded-md animate-pulse" />
        <div className="h-64 bg-[#171717] border border-[#2e2e2e] rounded-md animate-pulse" />
      </div>
    </div>
  );
}
