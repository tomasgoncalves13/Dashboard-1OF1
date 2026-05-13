import { Card, CardContent } from "@/components/ui/card";

export function ModulePlaceholder({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardContent className="py-12 text-center space-y-2">
          <div className="text-sm font-medium">Coming up: {phase}</div>
          <div className="text-xs text-muted-foreground max-w-sm mx-auto">
            Database schema and routes are scaffolded. UI lands when this phase is implemented.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
