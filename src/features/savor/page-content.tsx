"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Radio, Plus, Search, Trash2, Sparkles, ChefHat } from "lucide-react"
import { toast } from "sonner"
import { ToolHeader } from "@/components/shared/tool-header"
import { ErrorBoundary } from "@/components/shared/error-boundary"
import type { Recipe } from "./types"

const defaultRecipes: Recipe[] = [
  {
    id: "default-1",
    name: "Classic Pancakes",
    ingredients: ["1 cup flour", "2 tbsp sugar", "1 egg", "3/4 cup milk", "1 tsp baking powder"],
    instructions: "Mix dry ingredients. Add egg and milk. Cook on griddle until golden.",
    category: "Breakfast",
    cuisine: "American",
    tags: ["quick", "breakfast"],
    createdAt: new Date().toISOString(),
  },
]

const CATEGORIES = ["All", "Breakfast", "Main Course", "Appetizer", "Dessert", "Salad", "Soup", "Drink", "Snack"]

function SavorContent() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [search, setSearch] = useState("")
  const [filterCategory, setFilterCategory] = useState("All")
  const [open, setOpen] = useState(false)
  const [newRecipe, setNewRecipe] = useState({ name: "", ingredients: "", instructions: "", category: "", cuisine: "", tags: "" })

  useEffect(() => {
    const stored = localStorage.getItem("savor_recipes")
    if (stored) {
      try { setRecipes(JSON.parse(stored)); return } catch {}
    }
    setRecipes(defaultRecipes)
  }, [])

  useEffect(() => {
    if (recipes.length > 0) {
      localStorage.setItem("savor_recipes", JSON.stringify(recipes))
    }
  }, [recipes])

  function addRecipe() {
    if (!newRecipe.name.trim() || !newRecipe.ingredients.trim()) {
      toast.error("Name and ingredients are required")
      return
    }
    const recipe: Recipe = {
      id: crypto.randomUUID(),
      name: newRecipe.name.trim(),
      ingredients: newRecipe.ingredients.split("\n").map(s => s.trim()).filter(Boolean),
      instructions: newRecipe.instructions.trim(),
      category: newRecipe.category || "Main Course",
      cuisine: newRecipe.cuisine || "Other",
      tags: newRecipe.tags.split(",").map(t => t.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
    }
    setRecipes(prev => [recipe, ...prev])
    setNewRecipe({ name: "", ingredients: "", instructions: "", category: "", cuisine: "", tags: "" })
    setOpen(false)
    toast.success("Recipe saved")
  }

  async function aiCategorize() {
    if (!newRecipe.name.trim()) {
      toast.error("Enter a recipe name first")
      return
    }
    try {
      const res = await fetch("/api/savor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRecipe.name,
          ingredients: newRecipe.ingredients.split("\n").filter(Boolean),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setNewRecipe(prev => ({
        ...prev,
        category: json.category ?? prev.category,
        cuisine: json.cuisine ?? prev.cuisine,
        tags: Array.isArray(json.tags) ? json.tags.join(", ") : prev.tags,
      }))
      toast.success("AI categorized recipe")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI categorization unavailable")
    }
  }

  function deleteRecipe(id: string) {
    setRecipes(prev => prev.filter(r => r.id !== id))
    toast.success("Recipe deleted")
  }

  const filtered = recipes.filter(r => {
    const matchesSearch = search === "" ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.ingredients.some(i => i.toLowerCase().includes(search.toLowerCase()))
    const matchesCategory = filterCategory === "All" || r.category === filterCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="min-h-screen flex flex-col">
      <ToolHeader title="Savor" icon={Radio} color="text-red-500" badge="Creative" />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Savor</h1>
            <p className="text-muted-foreground">Your family cookbook. Save, organize, and discover recipes.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button><Plus className="w-4 h-4 mr-2" /> New Recipe</Button>} />
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>New Recipe</DialogTitle>
                <DialogDescription>Add a recipe to your collection.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">Name</label>
                  <Input
                    placeholder="e.g. Grandma's Chocolate Cake"
                    value={newRecipe.name}
                    onChange={(e) => setNewRecipe(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Ingredients (one per line)</label>
                  <Textarea
                    placeholder="2 cups flour&#10;1 cup sugar&#10;3 eggs"
                    rows={4}
                    value={newRecipe.ingredients}
                    onChange={(e) => setNewRecipe(prev => ({ ...prev, ingredients: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Instructions</label>
                  <Textarea
                    placeholder="Mix ingredients. Bake at 350F for 30 min."
                    rows={3}
                    value={newRecipe.instructions}
                    onChange={(e) => setNewRecipe(prev => ({ ...prev, instructions: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Category</label>
                    <Input
                      placeholder="Dessert, Main Course..."
                      value={newRecipe.category}
                      onChange={(e) => setNewRecipe(prev => ({ ...prev, category: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Cuisine</label>
                    <Input
                      placeholder="Italian, Mexican..."
                      value={newRecipe.cuisine}
                      onChange={(e) => setNewRecipe(prev => ({ ...prev, cuisine: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Tags (comma-separated)</label>
                  <Input
                    placeholder="quick, dessert, chocolate"
                    value={newRecipe.tags}
                    onChange={(e) => setNewRecipe(prev => ({ ...prev, tags: e.target.value }))}
                  />
                </div>
                <Button variant="outline" size="sm" onClick={aiCategorize} className="w-full">
                  <Sparkles className="w-3 h-3 mr-2" /> Auto-categorize with AI
                </Button>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={addRecipe}>Save Recipe</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search recipes..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map(recipe => (
            <Card key={recipe.id} className="group">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{recipe.name}</CardTitle>
                    <CardDescription className="flex gap-1 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-xs">{recipe.category}</Badge>
                      <Badge variant="outline" className="text-xs">{recipe.cuisine}</Badge>
                      {recipe.tags.slice(0, 3).map(t => (
                        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => deleteRecipe(recipe.id)}>
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm space-y-2">
                  <div>
                    <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">Ingredients</span>
                    <ul className="list-disc list-inside text-muted-foreground mt-1">
                      {recipe.ingredients.slice(0, 5).map((ing, i) => (
                        <li key={i}>{ing}</li>
                      ))}
                      {recipe.ingredients.length > 5 && <li className="text-xs">+{recipe.ingredients.length - 5} more</li>}
                    </ul>
                  </div>
                  {recipe.instructions && (
                    <p className="text-muted-foreground line-clamp-2">{recipe.instructions}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <ChefHat className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No recipes found</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default function SavorPage() {
  return (
    <ErrorBoundary>
      <SavorContent />
    </ErrorBoundary>
  )
}
