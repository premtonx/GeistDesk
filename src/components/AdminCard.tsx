import React from 'react';
import { LucideIcon, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';

interface AdminCardProps {
  title: string;
  description: string;
  icon: any;
  path: string;
  badge?: string;
  color?: string;
  bgColor?: string;
  borderColor?: string;
  onClick: () => void | Promise<any>;
  className?: string;
  actionLabel?: string;
}

export function AdminCard({
  title,
  description,
  icon: Icon,
  path,
  badge,
  color = 'text-primary',
  bgColor = 'bg-primary/10',
  borderColor = 'border-primary/20',
  onClick,
  className,
  actionLabel
}: AdminCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className={cn("group h-full", className)}
    >
      <Card className="h-full border-slate-100 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 cursor-pointer transition-all duration-300 rounded-3xl overflow-hidden bg-white">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start mb-4">
            <div className={cn(
              "w-12 h-12 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-110 duration-300",
              bgColor,
              color,
              borderColor
            )}>
              <Icon className="w-6 h-6" />
            </div>
            {badge && (
              <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 border-slate-200 text-slate-400">
                {badge}
              </Badge>
            )}
          </div>
          <CardTitle className="text-xl font-bold text-slate-900 group-hover:text-primary transition-colors">
            {title}
          </CardTitle>
          <CardDescription className="text-sm text-slate-500 leading-relaxed min-h-[40px]">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {actionLabel || "Configure Section"}
            </span>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-primary group-hover:text-white transition-all duration-300">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
