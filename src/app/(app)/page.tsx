import { TwoColumnLayout } from "@/components/layout/two-column-layout";
import { Card, CardContent } from "@/components/ui/card";

export default function PracticePage() {
  return (
    <TwoColumnLayout
      left={
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Practice</h2>
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>Practice feed will appear here</p>
            </CardContent>
          </Card>
        </div>
      }
      right={
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Repertoire focus panel will appear here</p>
          </CardContent>
        </Card>
      }
    />
  );
}
