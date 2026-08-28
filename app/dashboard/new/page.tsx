import { AdCreateForm } from "@/components/features/ad-create-form"

export default function NewAdPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-heading text-4xl">New ad</h1>
        <p className="mt-2 text-muted-foreground">
          Script generation is free to review. Picture, voice, and composite cost 1 credit.
        </p>
      </div>
      <AdCreateForm />
    </div>
  )
}
