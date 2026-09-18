export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.02em] sm:text-[34px]">{title}</h1>
        {description && <p className="mt-1 max-w-xl text-[14px] text-ink-secondary">{description}</p>}
      </div>
      {action}
    </div>
  );
}
