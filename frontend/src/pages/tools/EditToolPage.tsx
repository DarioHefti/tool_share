import { useState, type FormEvent, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useToolStore } from '@/stores/toolStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TOOL_CATEGORIES, type ToolCategory } from '@/types'
import { ArrowLeft } from 'lucide-react'

export function EditToolPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const getToolById = useToolStore((s) => s.getToolById)
  const updateTool = useToolStore((s) => s.updateTool)
  const fetchMyTools = useToolStore((s) => s.fetchMyTools)

  const tool = getToolById(id ?? '')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ToolCategory>('Other')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!tool) void fetchMyTools()
  }, [tool, fetchMyTools])

  useEffect(() => {
    if (tool) {
      setName(tool.name)
      setDescription(tool.description)
      setCategory(tool.category)
    }
  }, [tool])

  if (!tool) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Tool not found.</p>
        <Button variant="link" onClick={() => navigate('/')}>Back to Dashboard</Button>
      </div>
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await updateTool(tool.id, { name, description, category })
      navigate('/')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Button variant="ghost" onClick={() => navigate('/')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Edit Tool</CardTitle>
        </CardHeader>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tool Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ToolCategory)}
              >
                {TOOL_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save Changes'}</Button>
              <Button type="button" variant="outline" onClick={() => navigate('/')}>Cancel</Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  )
}
