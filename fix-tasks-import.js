const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/admin/tasks/page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  /import \{ Calendar, CheckCircle2, Clock, MapPin, Sprout, Loader2, Plus, Trash2, Edit2, Users, Briefcase \} from 'lucide-react';/,
  "import { Calendar, CheckCircle2, Clock, MapPin, Sprout, Loader2, Plus, Trash2, Edit2, Users, Briefcase, X } from 'lucide-react';"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully fixed X import in tasks page');
