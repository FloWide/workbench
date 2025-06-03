#
# ~/.bash_profile
#

# Define the ASCII logo
logo="
                                        
               ///////////              
          /////////////////////         
       ////////////////////////         
     ///////////////////////            
       ////////    ////////             
   ////  ////        /////      //////  
   /////  //    /     ////     ///////  
   /////  /    ///     ///     ///////  
   //////     /////    //     ////////  
    ////////////////         ////////   
     ////////////////       ////////    
      /////////////////   /////////     
         ///////////////////////        
             ////////////////           
                                        
"

# Define system information
info="
FloWide Workbench Runner
-----------------------------
Python: $(python --version)
Streamlit: $(streamlit --version)
Node: $(node --version)
"

# Calculate the width of the logo
logo_width=$(echo "$logo" | head -n 1 | wc -c)

# Calculate the remaining width for the information
terminal_width=$(tput cols)
info_width=$((terminal_width - logo_width - 2))  # Subtract 2 for padding

# Print the Neofetch-like message
printf "%b%s%b%s\n" "\e[1;34m" "$logo" "\e[0m" "$(printf '%*s\n' "$info_width" "$info" | sed '2,$s/^/  /')"

[[ -f ~/.bashrc ]] && . ~/.bashrc