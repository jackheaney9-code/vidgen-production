import { AdCreateForm } from "@/components/features/ad-create-form"

export default function CreatePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-heading text-4xl">New ad</h1>
        <p className="mt-2 text-muted-foreground">
          Write a 15 or 30 second script for free. Approve it, then spend 1 credit on
          picture, voice, and composite.
        </p>
      </div>
      <AdCreateForm />
    </div>
  )
}
