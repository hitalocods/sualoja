const SKELETON_CARDS = Array.from({ length: 8 }, (_, idx) => idx);

export default function StoreLoading() {
  return (
    <div
      className="min-h-dvh pb-24"
      aria-busy="true"
      aria-label="Carregando loja"
    >
      <div className="store-skeleton h-[120px] w-full md:h-[220px]" />

      <div className="mx-auto max-w-[1200px] px-3 sm:px-6">
        <div
          className="relative -mt-7 rounded-[22px] p-4 shadow-sm sm:-mt-9 sm:rounded-[24px] sm:p-5"
          style={{
            backgroundColor: "var(--store-surface, #ffffff)",
            border: "1px solid var(--store-border, rgba(17, 24, 39, 0.08))",
          }}
        >
          <div className="flex items-center gap-3.5">
            <div className="store-skeleton -mt-10 h-16 w-16 shrink-0 rounded-full border-[3px] border-white shadow-md sm:-mt-11 sm:border-4" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="store-skeleton h-6 w-44 rounded-full sm:w-64" />
              <div className="store-skeleton h-4 w-36 rounded-full sm:w-52" />
            </div>
          </div>

          <div className="mt-3.5 flex flex-nowrap gap-2 overflow-hidden">
            <div className="store-skeleton h-8 w-28 shrink-0 rounded-full" />
            <div className="store-skeleton h-8 w-24 shrink-0 rounded-full" />
            <div className="store-skeleton h-8 w-32 shrink-0 rounded-full" />
            <div className="store-skeleton h-8 w-36 shrink-0 rounded-full" />
          </div>
        </div>
      </div>

      <div
        className="mt-3 border-y py-2.5 sm:py-3"
        style={{
          borderColor: "var(--store-border, rgba(17, 24, 39, 0.08))",
        }}
      >
        <div className="mx-auto max-w-[1200px] space-y-2 px-3 sm:px-6">
          <div className="store-skeleton h-11 w-full rounded-full" />
          <div className="flex flex-nowrap gap-2 overflow-hidden py-0.5">
            <div className="store-skeleton h-11 w-24 shrink-0 rounded-full" />
            <div className="store-skeleton h-11 w-28 shrink-0 rounded-full" />
            <div className="store-skeleton h-11 w-24 shrink-0 rounded-full" />
            <div className="store-skeleton h-11 w-32 shrink-0 rounded-full" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] px-3 pt-4 sm:px-6 sm:pt-6">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="store-skeleton h-6 w-36 rounded-full" />
          <div className="store-skeleton h-6 w-16 rounded-full" />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4 lg:gap-5">
          {SKELETON_CARDS.map((card) => (
            <div
              key={card}
              className="overflow-hidden rounded-[20px] sm:rounded-[22px]"
              style={{
                backgroundColor: "var(--store-surface, #ffffff)",
                border: "1px solid var(--store-border, rgba(17, 24, 39, 0.08))",
              }}
            >
              <div className="store-skeleton aspect-[4/5] w-full" />
              <div className="space-y-2 p-3 sm:p-3.5">
                <div className="store-skeleton h-4 w-4/5 rounded-full" />
                <div className="store-skeleton h-4 w-2/5 rounded-full" />
                <div className="flex items-center justify-between pt-1">
                  <div className="store-skeleton h-5 w-20 rounded-full" />
                  <div className="store-skeleton h-11 w-11 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
