import { Search, Trash2, X } from 'lucide-react'
import React, { useState } from 'react'
import { permanentDeleteMaterial, restoreMaterial } from '../services/apiService'
import DeleteModal from './DeleteModal'
import { useLoading } from './Loading/LoadingContext'
import MaterialCard from './MaterialCard'
import { useToast } from './Toast/ToastContext'

const TrashScreen = ({ 
  trashedMaterialsData = [], 
  onRefreshMaterials, 
  onRestoreMaterial,
  onRemoveMaterial,
  onRemoveMaterials
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [selectedItems, setSelectedItems] = useState([])
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false)

  const { showLoading, hideLoading } = useLoading()
  const { showToast } = useToast()

  // Use the data passed from Dashboard instead of local state
  const trashItems = trashedMaterialsData || []

  const clearSearch = () => {
    setSearchQuery('')
  }

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now - date) / (1000 * 60))
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`
    }
  }

  const getTagColor = (tag) => {
    if (tag.includes('Flashcard')) return 'bg-[#FFB3BA] text-[#4A4A4A]'
    if (tag.includes('Notes')) return 'bg-[#BAFFC9] text-[#4A4A4A]'
    if (tag.includes('Quiz')) return 'bg-[#BAE1FF] text-[#4A4A4A]'
    if (tag.includes('Files')) return 'bg-[#F0F0F0] text-[#4A4A4A]'
    return 'bg-[#F0F0F0] text-[#4A4A4A]'
  }

  const toggleSelectAll = () => {
    if (selectedItems.length === trashItems.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(trashItems.map(item => item.id))
    }
  }

  const toggleSelectItem = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(itemId => itemId !== id)
        : [...prev, id]
    )
  }

  const handleDeleteSelected = async () => {
    if (selectedItems.length === 0) return;
    setDeleteModalOpen(true);
  }

  const confirmDeleteSelected = async () => {
    try {
      showLoading()
      
      // Delete all selected items
      await Promise.all(selectedItems.map(id => permanentDeleteMaterial(id)))
      
      // Update Dashboard state immediately - remove from trash
      if (onRemoveMaterials) {
        onRemoveMaterials(selectedItems)
      }
      
      // Clear selections
      setSelectedItems([])
      
      showToast({
        variant: "success",
        title: "Items deleted",
        subtitle: `${selectedItems.length} item(s) have been permanently deleted.`,
      })
    } catch (error) {
      console.error('Error deleting items:', error)
      showToast({
        variant: "error",
        title: "Error deleting items",
        subtitle: "Failed to delete some items. Please try again.",
      })
    } finally {
      hideLoading()
      setDeleteModalOpen(false);
    }
  }

  const handleRestore = async (material) => {
    try {
      showLoading()
      
      // Restore the material
      const response = await restoreMaterial(material.id)
      
      // Update Dashboard state using the callback (same pattern as EditProfileScreen)
      if (onRestoreMaterial) {
        onRestoreMaterial(response.data || material)
      }
      
      // Clear from selections if it was selected
      setSelectedItems(prev => prev.filter(id => id !== material.id))
      
      showToast({
        variant: "success",
        title: "Material restored",
        subtitle: "The material has been restored to your library.",
      })
    } catch (error) {
      console.error('Error restoring material:', error)
      showToast({
        variant: "error",
        title: "Error restoring material",
        subtitle: "Failed to restore the material. Please try again.",
      })
    } finally {
      hideLoading()
    }
  }

  const handleRestoreAll = async () => {
    if (selectedItems.length === 0) return;
    
    try {
      showLoading()
      
      // Restore all selected materials
      const restoredMaterials = await Promise.all(
        selectedItems.map(async (id) => {
          const response = await restoreMaterial(id)
          return response.data || trashItems.find(item => item.id === id)
        })
      )
      
      // Update Dashboard state for each restored material
      if (onRestoreMaterial) {
        restoredMaterials.forEach(material => {
          if (material) {
            onRestoreMaterial(material)
          }
        })
      }
      
      // Clear selections
      setSelectedItems([])
      
      showToast({
        variant: "success",
        title: "Materials restored",
        subtitle: `${selectedItems.length} item(s) have been restored to your library.`,
      })
    } catch (error) {
      showToast({
        variant: "error",
        title: "Error restoring materials",
        subtitle: "Failed to restore some items. Please try again.",
      })
    } finally {
      hideLoading()
    }
  }

  const handleDeleteAll = () => {
    if (trashItems.length === 0) return;
    setDeleteAllModalOpen(true);
  }

  const confirmDeleteAll = async () => {
    try {
      showLoading()
      
      // Delete all items
      await Promise.all(trashItems.map(item => permanentDeleteMaterial(item.id)))
      
      // Update Dashboard state immediately - remove all from trash
      if (onRemoveMaterials) {
        onRemoveMaterials(trashItems.map(item => item.id))
      }
      
      // Clear selections
      setSelectedItems([])
      
      showToast({
        variant: "success",
        title: "All items deleted",
        subtitle: `${trashItems.length} item(s) have been permanently deleted.`,
      })
    } catch (error) {
      console.error('Error deleting all items:', error)
      showToast({
        variant: "error",
        title: "Error deleting items",
        subtitle: "Failed to delete some items. Please try again.",
      })
    } finally {
      hideLoading()
      setDeleteAllModalOpen(false);
    }
  }

  // Filter items based on search query
  const filteredItems = trashItems.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Show loading state if data hasn't been loaded yet
  const isLoading = trashedMaterialsData === null

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 text-xs sm:text-sm">
        <div className="relative w-full sm:w-auto sm:max-w-md">
          <div className={`
            relative flex items-center
            transition-all duration-200
            ${isSearchFocused ? 'ring-1 ring-[#1b81d4]' : ''}
            rounded-full border border-gray-200
            bg-white
          `}>
            <Search 
              className={`
                absolute left-4
                transition-colors duration-200
                ${isSearchFocused ? 'text-[#1b81d4]' : 'text-gray-400'}
              `} 
              size={20} 
            />
            <input
              type="text"
              placeholder="Search in trash..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="label-text w-full pl-12 pr-12 py-2 border border-[#7BA7CC] rounded-full focus:outline-none text-sm"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-4 p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={16} className="text-gray-400" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-1 text-xs text-gray-500">
              Found {filteredItems.length} results
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            data-hover="Select All"
            className={`exam-button-mini py-1 px-2 flex items-center gap-1 ${selectedItems.length === trashItems.length ? 'bg-blue-500 text-white' : ''}`}
            onClick={toggleSelectAll}
            disabled={isLoading || trashItems.length === 0}
          >
            Select All
          </button>
          <button 
            data-hover="Restore Selected"
            className={`exam-button-mini py-1 px-2 flex items-center gap-1 ${
              selectedItems.length > 0 
                ? 'text-[#7BA7CC] hover:text-[#1b81d4]' 
                : 'text-gray-400 cursor-not-allowed'
            }`}
            onClick={handleRestoreAll}
            disabled={selectedItems.length === 0 || isLoading}
          >
            Restore Selected
          </button>
          <button 
            data-hover="Delete Selected"
            className={`exam-button-mini py-1 px-2 flex items-center gap-1 ${
              selectedItems.length > 0 
                ? 'text-red-500 hover:text-red-600' 
                : 'text-gray-400 cursor-not-allowed'
            }`}
            onClick={handleDeleteSelected}
            disabled={selectedItems.length === 0 || isLoading}
          >
            Delete Selected
          </button>
          <button 
            data-hover="Delete All"
            className={`exam-button-mini py-1 px-2 flex items-center gap-1 ${
              trashItems.length > 0 
                ? 'text-red-500 hover:text-red-600' 
                : 'text-gray-400 cursor-not-allowed'
            }`}
            onClick={handleDeleteAll}
            disabled={trashItems.length === 0 || isLoading}
          >
            Delete All
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading trash items...</p>
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <MaterialCard
              key={item.id}
              file={item}
              variant="trash"
              isPublic={false}
              timeAgo={formatTimeAgo(item.updated_at)}
              getTagColor={getTagColor}
              isSelected={selectedItems.includes(item.id)}
              onSelect={(id) => toggleSelectItem(id)}
              onRestore={handleRestore}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-12rem)] py-12">
          <Trash2 size={64} className="text-[#1b81d4] mb-6" />
          <h3 className="label-text text-2xl font-semibold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-3">
            Your Trash is Empty
          </h3>
          <p className="text-gray-600 text-center max-w-md leading-relaxed mb-6">
            When you delete materials, they will appear here. You can recover them or permanently delete them from your account.
          </p>
        </div>
      )}

      <DeleteModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDeleteSelected}
        title="Delete Selected Items"
        message={`Are you sure you want to permanently delete ${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText="Delete Permanently"
      />

      <DeleteModal
        isOpen={deleteAllModalOpen}
        onClose={() => setDeleteAllModalOpen(false)}
        onConfirm={confirmDeleteAll}
        title="Delete All Items"
        message={`Are you sure you want to permanently delete all ${trashItems.length} item${trashItems.length !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText="Delete All Permanently"
      />
    </div>
  )
}

export default TrashScreen