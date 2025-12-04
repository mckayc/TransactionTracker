
import React from 'react';

// Helper to render monochrome emojis that inherit text color
// The style `color: transparent; text-shadow: 0 0 0 currentColor;` forces the emoji to be flat and take the text color.
const EmojiIcon = ({ symbol, className = "", ...props }: { symbol: string; className?: string } & React.HTMLAttributes<HTMLSpanElement>) => {
    // Filter out SVG-specific props that might be passed from legacy code
    const { strokeWidth, fill, stroke, ...spanProps } = props as any;
    
    return (
        <span 
            className={`inline-flex items-center justify-center select-none ${className}`} 
            style={{ 
                color: 'transparent', 
                textShadow: '0 0 0 currentColor', 
                fontSize: '1.2em', 
                lineHeight: 1 
            }}
            role="img"
            aria-hidden="true"
            {...spanProps}
        >
            {symbol}
        </span>
    );
};

export const UploadIcon = (props: any) => <EmojiIcon symbol="📤" {...props} />;
export const DownloadIcon = (props: any) => <EmojiIcon symbol="📥" {...props} />;
export const SaveIcon = (props: any) => <EmojiIcon symbol="💾" {...props} />;
export const CheckCircleIcon = (props: any) => <EmojiIcon symbol="✅" {...props} />;
export const ExclamationTriangleIcon = (props: any) => <EmojiIcon symbol="⚠️" {...props} />;
export const DashboardIcon = (props: any) => <EmojiIcon symbol="📊" {...props} />;
export const TableIcon = (props: any) => <EmojiIcon symbol="📋" {...props} />;
export const CalendarIcon = (props: any) => <EmojiIcon symbol="📅" {...props} />;
export const CreditCardIcon = (props: any) => <EmojiIcon symbol="💳" {...props} />;
export const SettingsIcon = (props: any) => <EmojiIcon symbol="⚙️" {...props} />;
export const TasksIcon = (props: any) => <EmojiIcon symbol="☑️" {...props} />;
export const ChecklistIcon = (props: any) => <EmojiIcon symbol="📝" {...props} />;
export const RepeatIcon = (props: any) => <EmojiIcon symbol="🔄" {...props} />;
export const MenuIcon = (props: any) => <EmojiIcon symbol="☰" {...props} />;
export const CloseIcon = (props: any) => <EmojiIcon symbol="✖️" {...props} />;
export const SortIcon = (props: any) => <EmojiIcon symbol="⇅" {...props} />;
export const EditIcon = (props: any) => <EmojiIcon symbol="✏️" {...props} />;
export const NotesIcon = (props: any) => <EmojiIcon symbol="🗒️" {...props} />;
export const DeleteIcon = (props: any) => <EmojiIcon symbol="🗑️" {...props} />;
export const AddIcon = (props: any) => <EmojiIcon symbol="➕" {...props} />;
export const ChartPieIcon = (props: any) => <EmojiIcon symbol="🍩" {...props} />; // Donut for Chart
export const ChatBubbleIcon = (props: any) => <EmojiIcon symbol="💬" {...props} />;
export const SendIcon = (props: any) => <EmojiIcon symbol="🚀" {...props} />;
export const LinkIcon = (props: any) => <EmojiIcon symbol="🔗" {...props} />;
export const SparklesIcon = (props: any) => <EmojiIcon symbol="✨" {...props} />;
export const UsersIcon = (props: any) => <EmojiIcon symbol="👥" {...props} />;
export const UserGroupIcon = (props: any) => <EmojiIcon symbol="👨‍👩‍👧‍👦" {...props} />;
export const TagIcon = (props: any) => <EmojiIcon symbol="🏷️" {...props} />;
export const DuplicateIcon = (props: any) => <EmojiIcon symbol="❐" {...props} />;
export const CheckBadgeIcon = (props: any) => <EmojiIcon symbol="🎖️" {...props} />;
export const PlayIcon = (props: any) => <EmojiIcon symbol="▶️" {...props} />;
export const WizardIcon = (props: any) => <EmojiIcon symbol="🪄" {...props} />;
export const DocumentIcon = (props: any) => <EmojiIcon symbol="📄" {...props} />;
export const LightBulbIcon = (props: any) => <EmojiIcon symbol="💡" {...props} />;
export const CloudArrowUpIcon = (props: any) => <EmojiIcon symbol="☁️" {...props} />;
export const CurrencyDollarIcon = (props: any) => <EmojiIcon symbol="💲" {...props} />;
export const RobotIcon = (props: any) => <EmojiIcon symbol="🤖" {...props} />;
export const SearchCircleIcon = (props: any) => <EmojiIcon symbol="🔍" {...props} />;
export const WrenchIcon = (props: any) => <EmojiIcon symbol="🔧" {...props} />;
export const InfoIcon = (props: any) => <EmojiIcon symbol="ℹ️" {...props} />;
export const EyeIcon = (props: any) => <EmojiIcon symbol="👁️" {...props} />;
export const EyeSlashIcon = (props: any) => <EmojiIcon symbol="🙈" {...props} />;
export const FolderIcon = (props: any) => <EmojiIcon symbol="📁" {...props} />;
export const DragHandleIcon = (props: any) => <EmojiIcon symbol="⠿" {...props} />;
export const ChevronRightIcon = (props: any) => <EmojiIcon symbol="›" style={{ fontWeight: 'bold' }} {...props} />;
export const ChevronLeftIcon = (props: any) => <EmojiIcon symbol="‹" style={{ fontWeight: 'bold' }} {...props} />;
export const ChevronDownIcon = (props: any) => <EmojiIcon symbol="⌄" style={{ fontWeight: 'bold', position: 'relative', top: '-0.2em' }} {...props} />;
export const ExternalLinkIcon = (props: any) => <EmojiIcon symbol="↗" {...props} />;
export const HeartIcon = (props: any) => <EmojiIcon symbol="♥️" {...props} />;
export const PrinterIcon = (props: any) => <EmojiIcon symbol="🖨️" {...props} />;
export const ShieldCheckIcon = (props: any) => <EmojiIcon symbol="🛡️" {...props} />;
export const SplitIcon = (props: any) => <EmojiIcon symbol="✂️" {...props} />;
