import { Card, CardContent } from "@/components/ui/card";

export default function RepertoirePage() {
  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <h2 className="text-xl font-semibold tracking-tight mb-4">Repertoire</h2>
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <p>Repertoire database will appear here</p>
        </CardContent>
      </Card>
    </div>
  );
}
