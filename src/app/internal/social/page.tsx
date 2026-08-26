import type { Metadata } from "next";
import { requireAgent } from "@/lib/agent-auth";
import { getDraftSocialPosts, getPostingWorklist } from "@/lib/social-queue";
import { SocialPostReviewForm } from "@/components/social-post-review-form";
import { PostingWorklist } from "@/components/posting-worklist";

export const metadata: Metadata = {
  title: "Social — LEVR Auto Internal",
};

export const dynamic = "force-dynamic";

export default async function InternalSocialPage() {
  const agent = await requireAgent();
  const [drafts, worklist] = await Promise.all([getDraftSocialPosts(), getPostingWorklist()]);

  return (
    <section className="min-h-screen bg-zinc-950 py-16">
      <div className="mx-auto max-w-4xl px-6">
        <h1 className="text-2xl font-semibold text-white">Social</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Signed in as {agent.name} ({agent.email})
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          One weekly batch across 7 daily themes, generated automatically and awaiting review below.
          Nothing posts on its own — approving here only marks content ready; actually posting it (or
          marking it posted once you have) happens in the worklist further down.
        </p>

        <div className="mt-10 space-y-8">
          {drafts.length === 0 ? (
            <p className="text-sm text-zinc-500">No drafts awaiting review right now.</p>
          ) : (
            drafts.map((draft) => <SocialPostReviewForm key={`${draft.id}:${draft.updatedAt}`} post={draft} />)
          )}
        </div>

        <div className="mt-14">
          <h2 className="text-lg font-semibold text-white">
            Ready to post <span className="text-sm font-normal text-zinc-500">({worklist.length})</span>
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Approved content whose scheduled time has arrived — copy the text (and grab the image) into
            each platform by hand, then mark it posted here.
          </p>
          <div className="mt-4">
            <PostingWorklist items={worklist} />
          </div>
        </div>
      </div>
    </section>
  );
}
