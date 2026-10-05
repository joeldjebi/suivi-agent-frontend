import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'

export function LeadAvatar({ lead, className }: { lead: { firstName: string; lastName: string }; className?: string }) {
  return (
    <Avatar className={cn('size-9', className)}>
      <AvatarFallback className="bg-primary/10 text-primary">{initials(lead)}</AvatarFallback>
    </Avatar>
  )
}
