/** Where to find the Canvas calendar feed link: three steps and a sketch of the Canvas calendar page. */
export function CanvasHowTo() {
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_15rem] sm:items-start">
      <ol className="flex flex-col gap-2 text-sm">
        <li><span className="num mr-2 text-ink-muted">1</span>In Canvas, click <strong className="font-medium">Calendar</strong> in the left sidebar.</li>
        <li><span className="num mr-2 text-ink-muted">2</span>At the bottom right, under your list of calendars, click <strong className="font-medium">Calendar Feed</strong>.</li>
        <li><span className="num mr-2 text-ink-muted">3</span>Copy the link it shows and paste it below.</li>
      </ol>
      <figure className="flex flex-col gap-1">
        {/* A sketch, not a screenshot: sidebar, month grid, calendar list, and the Calendar Feed button. */}
        <div aria-hidden="true" className="flex h-32 gap-1.5 rounded-sm border border-rule p-1.5">
          <div className="flex w-8 flex-col gap-1">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-2 rounded-[2px] bg-rule" />)}
            <div className="flex h-4 items-center justify-center rounded-[2px] bg-highlight text-[0.45rem] font-medium leading-none">Calendar</div>
            <div className="h-2 rounded-[2px] bg-rule" />
          </div>
          <div className="grid flex-1 grid-cols-7 grid-rows-5 gap-px">
            {Array.from({ length: 35 }, (_, i) => <div key={i} className="rounded-[1px] border border-rule" />)}
          </div>
          <div className="flex w-12 flex-col gap-1">
            {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-1.5 rounded-[2px] bg-rule" />)}
            <div className="mt-auto flex h-4 items-center justify-center rounded-[2px] bg-highlight text-[0.45rem] font-medium leading-none">
              Calendar Feed
            </div>
          </div>
        </div>
        <figcaption className="text-xs text-ink-muted">Canvas calendar page: Calendar on the left, Calendar Feed at the bottom right.</figcaption>
      </figure>
    </div>
  );
}
