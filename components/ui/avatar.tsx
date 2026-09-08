import * as React from 'react'
import { avatarColor, cn, initials } from '@/lib/utils'

export type AvatarSize = 'sm' | 'md' | 'lg'

const avatarSizes: Record<AvatarSize, string> = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
}

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Display name — the source of the initials. */
  name: string
  /** Stable seed for the tint; falls back to the name when omitted. */
  id?: string
  size?: AvatarSize
}

export const Avatar = React.forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { name, id, size = 'md', className, ...props },
  ref
) {
  return (
    <span
      ref={ref}
      title={name}
      aria-label={name}
      role="img"
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold uppercase ring-1 ring-inset ring-black/5 dark:ring-white/10',
        avatarSizes[size],
        avatarColor(id ?? name),
        className
      )}
      {...props}
    >
      <span aria-hidden="true">{initials(name)}</span>
    </span>
  )
})
