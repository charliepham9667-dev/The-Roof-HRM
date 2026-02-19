import { Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui"

export function ComingSoon({
  title,
  description,
  next,
}: {
  title: string
  description: string
  next?: string[]
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      <Card>
        <CardHeader>
          <CardTitle>Coming next</CardTitle>
          <CardDescription>
            This is a wireframe placeholder so navigation and access control can be validated first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {(next && next.length > 0 ? next : ["Define requirements", "Add UI + data", "Ship MVP"]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

