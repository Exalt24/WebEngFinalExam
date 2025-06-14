import { ArrowLeft, Edit, FileText, Search } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useToast } from '../components/Toast/ToastContext';
import { createCombinedSuccessMessage, trackActivityAndNotify } from '../utils/streakNotifications';

const ViewNotes = ({ 
  mainMaterial, 
  material, 
  onClose, 
  readOnly = false, 
  onSuccess,
  onEdit // ✅ NEW: Navigation handler for editing
}) => {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  // ✅ REMOVED: showCreateNotes state (no longer needed)
  
  // Streak tracking state
  const [studyStartTime] = useState(Date.now());
  const [hasTrackedActivity, setHasTrackedActivity] = useState(false);
  const [isActivelyReading, setIsActivelyReading] = useState(true);
  const lastActivityRef = useRef(Date.now());
  
  // Use actual material data
  const noteContent = material?.content || '';
  const noteTitle = material?.title || 'Untitled Note';
  const noteDescription = material?.description || 'View and review your notes';
  
  // Track time spent studying
  useEffect(() => {
    const MINIMUM_STUDY_TIME = 2 * 60 * 1000; // 2 minutes
    const ACTIVITY_TIMEOUT = 30 * 1000; // 30 seconds of inactivity
    
    // Update last activity on any interaction
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      setIsActivelyReading(true);
    };
    
    // Check if user is still actively reading
    const checkActivity = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity > ACTIVITY_TIMEOUT) {
        setIsActivelyReading(false);
      }
    }, 5000); // Check every 5 seconds
    
    // Track study activity if enough time has passed
    const trackingInterval = setInterval(async () => {
      const totalStudyTime = Date.now() - studyStartTime;
      
      if (!hasTrackedActivity && 
          totalStudyTime >= MINIMUM_STUDY_TIME && 
          isActivelyReading) {
        
        setHasTrackedActivity(true);
        
        // Track activity but suppress immediate notification
        const streakResult = await trackActivityAndNotify(showToast, true);
        
        // Create combined message using helper function
        const baseTitle = "Study session completed!";
        const baseSubtitle = `You've been actively studying "${noteTitle}" for ${Math.round(totalStudyTime / 60000)} minutes.`;
        
        const combinedMessage = createCombinedSuccessMessage(baseTitle, baseSubtitle, streakResult);
        
        // Show single combined toast
        showToast({
          variant: "success",
          title: combinedMessage.title,
          subtitle: combinedMessage.subtitle,
        });
      }
    }, 10000); // Check every 10 seconds
    
    // Add event listeners for user activity
    const events = ['scroll', 'mousemove', 'keydown', 'click'];
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });
    
    // Cleanup
    return () => {
      clearInterval(checkActivity);
      clearInterval(trackingInterval);
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
    };
  }, [studyStartTime, hasTrackedActivity, isActivelyReading, showToast, noteTitle]);
  
  const handleSearch = async (query) => {
    setSearchQuery(query);
    
    // If user is actively searching, consider it study activity
    if (query.length >= 3 && !hasTrackedActivity) {
      setHasTrackedActivity(true);
      
      // Track activity but suppress immediate notification
      const streakResult = await trackActivityAndNotify(showToast, true);
      
      // Create combined message using helper function
      const baseTitle = "Active studying detected!";
      const baseSubtitle = `You're actively engaging with "${noteTitle}" content.`;
      
      const combinedMessage = createCombinedSuccessMessage(baseTitle, baseSubtitle, streakResult);
      
      // Show single combined toast
      showToast({
        variant: "success",
        title: combinedMessage.title,
        subtitle: combinedMessage.subtitle,
      });
    }
  };

  // ✅ UPDATED: Use navigation instead of local state
  const handleEdit = () => {
    if (!readOnly && onEdit) {
      onEdit(material); // Navigate to edit route
    }
  };

  // ✅ REMOVED: handleEditSuccess (no longer needed with routing)
  // ✅ REMOVED: showCreateNotes logic (no longer needed with routing)

  // Function to highlight text
  const highlightText = (html, query) => {
    if (!query) return html;

    // Escape special characters in the query for regex
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return html.replace(regex, '<span class="bg-yellow-200">$1</span>');
  };

  // Simple check for common markdown syntax (can be refined)
  const containsMarkdown = (text) => {
    if (!text) return false;
    // Check for code blocks, headers, lists, bold/italic as indicators
    return /```/.test(text) || /^#+\s/.test(text) || /[-*+]\s/.test(text) || /_.*_/g.test(text) || /\*.*\*/g.test(text);
  };

  // Determine which rendering method to use
  const shouldUseMarkdown = containsMarkdown(noteContent);

  // ✅ REMOVED: Conditional rendering of CreateNotes

  return (
    <div className="flex flex-col bg-gradient-to-br from-purple-50 via-fuchsia-50 to-pink-50 rounded-xl h-[calc(100vh-7rem)] sm:h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="flex-none border-b rounded-t-xl border-gray-200 bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 p-2 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-xl transition-all duration-200 hover:scale-105"
            >
              <ArrowLeft size={18} className="sm:w-5 sm:h-5 text-gray-600" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg md:text-xl font-semibold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent label-text truncate max-w-[200px] sm:max-w-[300px] md:max-w-[400px]">
                {noteTitle}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 label-text truncate max-w-[200px] sm:max-w-[300px] md:max-w-[400px]">
                {noteDescription}
                {/* Show study progress indicator */}
                {isActivelyReading && !hasTrackedActivity && (
                  <span className="ml-2 text-purple-600">• Studying...</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            {/* Search functionality with streak tracking */}
            <div className="relative flex-1 sm:flex-none">
              <input
                type="text"
                placeholder="Search in note..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full sm:w-64 pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400/30 focus:border-purple-500 transition-all duration-200 hover:border-gray-300 label-text text-sm"
              />
              <Search size={16} className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            </div>
            {/* Edit button */}
            {!readOnly && onEdit && (
              <>
                <div className="h-6 w-px bg-gray-200 hidden sm:block"></div>
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 text-gray-600 hover:text-gray-800 transition-all duration-200 hover:scale-105"
                >
                  <Edit size={16} className="sm:w-5 sm:h-5" />
                  <span className="label-text text-sm hidden sm:inline">Edit</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Content section */}
      <div className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto px-2 sm:px-4 md:px-6 py-2 sm:py-4 h-full">
          {noteContent ? (
            <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl p-3 sm:p-6 md:p-8 shadow-lg hover:shadow-xl transition-all duration-300 h-full">
              {/* Note info header */}
              <div className="flex items-center justify-between mb-3 sm:mb-6">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 sm:p-2 bg-purple-50 rounded-lg">
                    <FileText size={16} className="sm:w-5 sm:h-5 text-purple-500" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium text-gray-700 label-text">
                    {searchQuery ? `Searching for "${searchQuery}"` : 'Note Content'}
                  </span>
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="text-xs sm:text-sm text-purple-600 hover:text-purple-800 transition-colors label-text"
                  >
                    Clear search
                  </button>
                )}
              </div>

              {/* Note content with proper scrolling */}
              <div className="relative h-[calc(100%-4rem)] sm:h-[calc(100%-5rem)] overflow-hidden">
                <div className="absolute inset-0 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-purple-300/50 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-purple-400/50">
                  <div className="overflow-x-auto">
                    <div
                      className="prose prose-sm sm:prose-base max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-em:text-gray-600 whitespace-pre-wrap break-words"
                      style={{ maxWidth: '100%', wordBreak: 'break-word' }}
                    >
                      {shouldUseMarkdown ? (
                        // Use ReactMarkdown for content detected as markdown
                        <ReactMarkdown>{noteContent}</ReactMarkdown>
                      ) : (
                        // Use dangerouslySetInnerHTML with highlighting for other content
                        <div dangerouslySetInnerHTML={{
                          __html: highlightText(noteContent, searchQuery)
                        }} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Empty state
            <div className="text-center py-6 sm:py-8 md:py-12">
              <div className="p-3 sm:p-4 bg-gray-100 rounded-full w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 mx-auto mb-3 sm:mb-4 flex items-center justify-center">
                <FileText size={24} className="sm:w-8 sm:h-8 md:w-12 md:h-12 text-gray-400" />
              </div>
              <h3 className="text-base sm:text-lg md:text-xl font-medium text-gray-900 mb-1 sm:mb-2 label-text">No content available</h3>
              <p className="text-xs sm:text-sm md:text-base text-gray-600 label-text">This note is empty.</p>
              {!readOnly && onEdit && (
                <button
                  onClick={handleEdit}
                  className="mt-3 sm:mt-4 exam-button-mini text-sm sm:text-base"
                  data-hover="Add Content"
                >
                  Add Content
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewNotes;